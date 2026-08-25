/**
 * 免费使用 DeepSeek：通过本地 Python 库 deepseek-notoken-api 调用
 * chat.deepseek.com 网页版，无需 API Key。
 *
 * 依赖: pip install deepseek-notoken-api playwright（参考
 * C:\Users\Canary\Library\Code\GithubProject\deepseek-notoken-api）
 */
const {execFile, spawn} = require('child_process');
const fs = require('fs');
const path = require('path');
const {logger} = require('./logging');

const log = logger('deepseek-free');

// 紧凑的 Python 桥接脚本: 通过 -c 传入, action 走 argv, payload 走 stdin。
// 避免超长消息（完整上下文 + 巨大 XML）超出 Windows 命令行长度限制(ENAMETOOLONG)。
// 永远以一行 JSON 输出到 stdout, 绝不抛异常。
const PYTHON_SCRIPT = [
  'import json, sys',
  'try:',
  '    import deepseek_notoken_api as d',
  'except Exception as e:',
  '    print(json.dumps({"ok": False, "error": "PythonException:未安装 deepseek-notoken-api: %s" % e}))',
  '    sys.exit(0)',
  'action = sys.argv[1]',
  'try:',
  '    payload = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}',
  'except Exception:',
  '    payload = {}',
  'try:',
  '    if action == "has_session":',
  '        print(json.dumps({"ok": True, "hasSession": bool(d.has_session())}))',
  '    elif action == "login":',
  '        print(json.dumps({"ok": True, "result": d.login()}))',
  '    elif action == "input":',
  '        print(json.dumps({"ok": True, "result": d.input(payload)}))',
  '    elif action == "close":',
  '        print(json.dumps({"ok": True, "result": d.close()}))',
  '    else:',
  '        print(json.dumps({"ok": False, "error": "UnknownException:unknown action %s" % action}))',
  'except Exception as e:',
  '    print(json.dumps({"ok": False, "error": "UnknownException:%s" % e}))'
].join('\n');

const getTimeout = action => {
  if (action === 'login') return 360000; // 登录等待最长 300 秒 + 启动余量
  if (action === 'input') return 300000; // 回复等待最长 180 秒 + 启动余量
  return 30000;
};

/**
 * 解析要使用的 Python 解释器。
 * 优先使用用户显式配置的路径；留空时自动探测常见的
 * deepseek-notoken-api 虚拟环境，最后回退到 PATH 中的 python。
 * @param {string} pythonPath
 * @returns {string}
 */
const resolvePython = pythonPath => {
  if (pythonPath) return pythonPath;
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [];
  if (home) {
    candidates.push(
      path.join(home, 'Library', 'Code', 'GithubProject', 'deepseek-notoken-api', '.venv', 'Scripts', 'python.exe'),
      path.join(home, 'Code', 'GithubProject', 'deepseek-notoken-api', '.venv', 'Scripts', 'python.exe'),
      path.join(home, 'GithubProject', 'deepseek-notoken-api', '.venv', 'Scripts', 'python.exe'),
      path.join(home, 'deepseek-notoken-api', '.venv', 'Scripts', 'python.exe'),
      path.join(home, '.venvs', 'deepseek-notoken-api', 'Scripts', 'python.exe')
    );
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        log.info('DeepSeek free Python auto-detected', {pythonPath: candidate});
        return candidate;
      }
    } catch (error) {
      // ignore
    }
  }
  return 'python';
};

const run = (pythonPath, action, payload) => new Promise(resolve => {
  const command = resolvePython(pythonPath);
  const args = ['-c', PYTHON_SCRIPT, action];
  log.info('DeepSeek free Python call started', {action, command});
  // 用 spawn + 手动写 stdin, 避免 execFile 的 input 在 Windows 上不可靠,
  // 也避免超长 payload 超出 Windows 命令行长度限制 (ENAMETOOLONG)。
  const child = spawn(command, args, {
    windowsHide: true,
    env: {...process.env, PYTHONIOENCODING: 'utf-8'}
  });
  let stdoutText = '';
  let stderrText = '';
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    child.kill();
    log.warn('DeepSeek free Python call timed out', {action});
    resolve({ok: false, error: `PythonException:${action} 超时（${getTimeout(action) / 1000} 秒）`});
  }, getTimeout(action));
  child.stdout.on('data', chunk => {
    stdoutText += chunk;
  });
  child.stderr.on('data', chunk => {
    stderrText += chunk;
  });
  child.on('error', error => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    log.warn('DeepSeek free Python call failed', {action, error: error.message});
    resolve({ok: false, error: `PythonException:${error.message}`});
  });
  child.on('close', () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    const lines = stdoutText.trim().split(/\r?\n/).filter(Boolean);
    let parsed = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        parsed = JSON.parse(lines[i]);
        break;
      } catch (e) {
        // 跳过非 JSON 输出行（例如库打印的提示）
      }
    }
    if (!parsed) {
      const detail = stderrText.trim() ? `\n${stderrText.trim().slice(0, 2000)}` : '';
      resolve({ok: false, error: `PythonException:没有输出${detail}`});
      return;
    }
    log.info('DeepSeek free Python call completed', {action, ok: parsed.ok});
    if (parsed.ok) {
      resolve(parsed);
    } else {
      resolve({ok: false, error: parsed.error || 'UnknownException:未知错误'});
    }
  });
  child.stdin.write(JSON.stringify(payload || {}));
  child.stdin.end();
});

const checkLogin = (pythonPath) => run(pythonPath, 'has_session', {})
  .then(result => result.ok
    ? {ok: true, hasSession: Boolean(result.hasSession)}
    : {ok: false, error: result.error});

const login = (pythonPath) => run(pythonPath, 'login', {});

const input = (pythonPath, payload) => run(pythonPath, 'input', payload);

const close = (pythonPath) => run(pythonPath, 'close', {});

module.exports = {
  checkLogin,
  login,
  input,
  close
};
