const fs = require('fs');
const path = require('path');
const {exec, execFile} = require('child_process');
const {app, safeStorage} = require('electron');
const settings = require('./settings');
const {logger} = require('./logging');
const deepseekFree = require('./deepseek-free');

const log = logger('ai-service');

const DEFAULT_PERMISSIONS = {
  insertScript: true,
  replaceScript: true,
  deleteScript: false,
  updateVariable: false,
  updateSprite: false,
  updateTarget: false,
  loadExtension: false,
  manageTargets: false,
  projectControl: false,
  callVmMethod: false,
  callTargetMethod: false
};

const DEFAULT_CONFIG = {
  apiUrl: '',
  model: '',
  contextMode: 'target',
  freeDeepSeek: false,
  freeDeepSeekPython: '',
  webSearch: {
    urlTemplate: 'https://cn.bing.com/search?q={ask}',
    proxyMode: 'system',
    proxyAddress: '',
    requestTool: 'curl',
    customCommand: ''
  },
  permissions: DEFAULT_PERMISSIONS
};

const KEY_PATH = path.join(app.getPath('userData'), 'ai-api-key.bin');
const LAST_SESSION_PATH = path.join(app.getPath('userData'), 'ai-last-session.json');
const EDITOR_REQUEST_TIMEOUT = 15000;
const MAX_CONTEXT_PROMPT_CHARS = Number.MAX_SAFE_INTEGER;
const MAX_HISTORY_MESSAGES = Number.MAX_SAFE_INTEGER;
const MAX_HISTORY_MESSAGE_CHARS = Number.MAX_SAFE_INTEGER;
const MAX_ERROR_BODY_CHARS = 4000;
const MAX_CONTEXT_REQUESTS = Number.MAX_SAFE_INTEGER;
const MAX_SAVED_MESSAGES = Number.MAX_SAFE_INTEGER;
const WEB_SEARCH_TIMEOUT = 30000;
const MAX_WEB_SEARCH_QUERIES = 5;
const MAX_WEB_SEARCH_RESULT_CHARS = 20000;
const SPEECH_RECOGNITION_TIMEOUT = 15000;

const decodeXMLAttribute = value => String(value || '')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const parseXMLAttributes = text => {
  const attrs = {};
  String(text || '').replace(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (match, name, doubleQuoted, singleQuoted) => {
    attrs[name] = decodeXMLAttribute(typeof doubleQuoted === 'string' ? doubleQuoted : singleQuoted);
    return match;
  });
  return attrs;
};

const unwrapOperationXML = content => {
  const text = String(content || '').trim();
  const xmlMatch = text.match(/^<xml\b[^>]*>[\s\S]*<\/xml>$/i);
  if (xmlMatch) return text;
  const blockMatch = text.match(/^<(?:block|shadow)\b[\s\S]*<\/(?:block|shadow)>$/i);
  if (blockMatch) return `<xml>${text}</xml>`;
  return '';
};

class AIService {
  constructor (editorWindow) {
    this.editorWindow = editorWindow;
    this.views = new Set([editorWindow.window.webContents]);
    this.messages = [];
    this.contextCatalog = [];
    this.contextSnapshot = null;
    this.pendingRequests = new Map();
    this.isStreaming = false;
    this.sessionKey = '';
    this.savedSession = this.loadSavedSession();
    this.config = {
      ...DEFAULT_CONFIG,
      ...settings.aiConfig,
      webSearch: {
        ...DEFAULT_CONFIG.webSearch,
        ...(settings.aiConfig && settings.aiConfig.webSearch)
      },
      permissions: {
        ...DEFAULT_PERMISSIONS,
        ...(settings.aiConfig && settings.aiConfig.permissions)
      }
    };
    log.info('AI service created', {
      contextMode: this.config.contextMode,
      permissions: this.config.permissions
    });
  }

  registerView (webContents) {
    this.views.add(webContents);
    webContents.once('destroyed', () => {
      this.views.delete(webContents);
      log.info('AI view destroyed', {viewCount: this.views.size});
    });
    log.info('AI view registered', {viewCount: this.views.size});
    this.broadcast();
  }

  attachIPC (ipc, isEditor = false) {
    ipc.handle('ai:get-state', () => this.getState());
    ipc.handle('ai:save-config', (event, input) => this.saveConfig(input || {}));
    ipc.handle('ai:fetch-models', () => this.fetchModels());
    ipc.handle('ai:continue-last-session', () => this.continueLastSession());
    ipc.handle('ai:start-new-session', () => this.startNewSession());
    ipc.handle('ai:set-context-catalog', (event, catalog) => {
      if (isEditor) this.setContextCatalog(catalog);
    });
    ipc.handle('ai:upload-context', (event, selection) => this.uploadContext(selection));
    ipc.handle('ai:send-message', (event, text, selection) => this.sendMessage(text, selection));
    ipc.handle('ai:recognize-speech', () => this.recognizeSpeech());
    ipc.handle('ai:free-check-login', () => deepseekFree.checkLogin(this.config.freeDeepSeekPython));
    ipc.handle('ai:free-login', () => deepseekFree.login(this.config.freeDeepSeekPython));
    ipc.handle('ai:free-close', () => deepseekFree.close(this.config.freeDeepSeekPython));
    if (isEditor) {
      ipc.on('ai:editor-response', (event, response) => {
        this.resolveEditorRequest(response && response.id, response && response.result, response && response.error);
      });
    }
  }

  getState () {
    return {
      config: {
        ...this.config,
        hasApiKey: Boolean(this.readKey()),
        secureStorageAvailable: safeStorage.isEncryptionAvailable()
      },
      messages: this.messages,
      contextCatalog: this.contextCatalog,
      hasContextSnapshot: Boolean(this.contextSnapshot),
      canContinueLastSession: this.messages.length === 0 && this.hasSavedSession(),
      savedSessionMessageCount: this.savedSession && Array.isArray(this.savedSession.messages) ? this.savedSession.messages.length : 0,
      savedSessionUpdatedAt: this.savedSession && this.savedSession.updatedAt,
      isStreaming: this.isStreaming
    };
  }

  broadcast () {
    const state = this.getState();
    for (const view of this.views) {
      if (!view.isDestroyed()) view.send('ai:state', state);
    }
  }

  readKey () {
    if (!safeStorage.isEncryptionAvailable()) return this.sessionKey;
    try {
      return fs.existsSync(KEY_PATH) ? safeStorage.decryptString(fs.readFileSync(KEY_PATH)) : '';
    } catch (error) {
      log.warn('Unable to read AI API key', error);
      return '';
    }
  }

  recognizeSpeech () {
    if (process.platform !== 'win32') {
      return Promise.reject(new Error('当前只支持 Windows 本地语音识别。'));
    }
    const script = `
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
try {
  $culture = [System.Globalization.CultureInfo]::GetCultureInfo('zh-CN')
  $recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::new($culture)
} catch {
  try {
    $recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::new()
  } catch {
    [Console]::Error.WriteLine('Windows 语音识别组件不可用，请在系统中安装语音识别功能。')
    exit 3
  }
}
try {
  $recognizer.SetInputToDefaultAudioDevice()
} catch {
  [Console]::Error.WriteLine('无法打开默认麦克风，请检查麦克风权限和输入设备。')
  exit 4
}
$script:done = [System.Threading.AutoResetEvent]::new($false)
$script:recognizedText = ''
$script:completedError = ''
$script:wasRejected = $false
try {
  $recognizer.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
} catch {
  [Console]::Error.WriteLine('无法加载中文听写语法，请检查 Windows 语音识别语言包。')
  exit 5
}
$recognizer.add_SpeechRecognized({
  param($sender, $eventArgs)
  if ($eventArgs.Result -and -not [string]::IsNullOrWhiteSpace($eventArgs.Result.Text)) {
    $script:recognizedText = $eventArgs.Result.Text
    [void]$script:done.Set()
  }
})
$recognizer.add_SpeechRecognitionRejected({
  $script:wasRejected = $true
})
$recognizer.add_RecognizeCompleted({
  param($sender, $eventArgs)
  if ($eventArgs.Error) {
    $script:completedError = $eventArgs.Error.Message
  }
  [void]$script:done.Set()
})
try {
  $recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Single)
  $finished = $script:done.WaitOne(10000)
} finally {
  try { $recognizer.RecognizeAsyncCancel() } catch {}
  try { $recognizer.Dispose() } catch {}
  try { $script:done.Dispose() } catch {}
}
if (-not $finished) {
  [Console]::Error.WriteLine('语音识别超时：没有检测到可识别的语音，请检查麦克风输入、系统语音语言和权限。')
  exit 6
}
if (-not [string]::IsNullOrWhiteSpace($script:completedError)) {
  [Console]::Error.WriteLine(('语音识别失败: ' + $script:completedError))
  exit 7
}
if ([string]::IsNullOrWhiteSpace($script:recognizedText)) {
  if ($script:wasRejected) {
    [Console]::Error.WriteLine('系统听到了声音，但没有识别成文字。请靠近麦克风或换成普通话重试。')
  } else {
    [Console]::Error.WriteLine('没有识别到语音。')
  }
  exit 2
}
$script:recognizedText
`;
    log.info('Native speech recognition started');
    return new Promise((resolve, reject) => {
      execFile('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script
      ], {
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true,
        maxBuffer: 64 * 1024
      }, (error, stdout, stderr) => {
        const message = String(stderr || '').trim();
        if (error) {
          log.warn('Native speech recognition failed', {
            code: error.code,
            killed: Boolean(error.killed),
            signal: error.signal,
            message: message || error.message
          });
          if (error.killed) {
            reject(new Error('语音识别进程超时：Windows 本地识别没有返回结果，请检查麦克风权限和中文语音包。'));
          } else {
            reject(new Error(message || `语音识别失败: ${error.message}`));
          }
          return;
        }
        const text = String(stdout || '').trim();
        if (!text) {
          log.warn('Native speech recognition returned empty text');
          reject(new Error('没有识别到语音。'));
          return;
        }
        log.info('Native speech recognition completed', {length: text.length});
        resolve(text);
      });
    });
  }

  sanitizeMessagesForSession (messages) {
    if (!Array.isArray(messages)) return [];
    return messages
      .filter(message => message && (message.role === 'user' || message.role === 'assistant'))
      .slice(-MAX_SAVED_MESSAGES)
      .map(message => ({
        role: message.role,
        content: typeof message.content === 'string' ? message.content : '',
        error: typeof message.error === 'string' ? message.error : undefined,
        operationResult: message.operationResult || null
      }));
  }

  loadSavedSession () {
    try {
      if (!fs.existsSync(LAST_SESSION_PATH)) return null;
      const parsed = JSON.parse(fs.readFileSync(LAST_SESSION_PATH, 'utf8'));
      const messages = this.sanitizeMessagesForSession(parsed && parsed.messages);
      return messages.length ? {updatedAt: parsed.updatedAt || null, messages} : null;
    } catch (error) {
      log.warn('Unable to load saved AI session', error);
      return null;
    }
  }

  hasSavedSession () {
    return Boolean(this.savedSession && Array.isArray(this.savedSession.messages) && this.savedSession.messages.length);
  }

  persistCurrentSession () {
    const messages = this.sanitizeMessagesForSession(this.messages);
    if (!messages.length) return;
    this.savedSession = {
      updatedAt: new Date().toISOString(),
      messages
    };
    try {
      fs.writeFileSync(LAST_SESSION_PATH, JSON.stringify(this.savedSession, null, 2));
    } catch (error) {
      log.warn('Unable to save AI session', error);
    }
  }

  continueLastSession () {
    this.savedSession = this.loadSavedSession();
    if (!this.hasSavedSession()) {
      throw new Error('没有可延续的上次 AI 会话');
    }
    if (this.isStreaming) {
      throw new Error('AI 正在回复，暂时不能切换会话');
    }
    this.messages = this.sanitizeMessagesForSession(this.savedSession.messages);
    log.info('AI session restored', {
      messageCount: this.messages.length,
      updatedAt: this.savedSession.updatedAt
    });
    this.broadcast();
    return this.getState();
  }

  startNewSession () {
    if (this.isStreaming) {
      throw new Error('AI 正在回复，暂时不能开启新会话');
    }
    this.messages = [];
    this.contextSnapshot = null;
    this.savedSession = this.loadSavedSession();
    log.info('AI new session started', {
      hasSavedSession: this.hasSavedSession()
    });
    this.broadcast();
    return this.getState();
  }

  async saveConfig (input) {
    const apiUrl = typeof input.apiUrl === 'string' ? input.apiUrl.trim().replace(/\/+$/, '') : this.config.apiUrl;
    const model = typeof input.model === 'string' ? input.model.trim() : this.config.model;
    const contextMode = ['target', 'project', 'custom'].includes(input.contextMode) ? input.contextMode : this.config.contextMode;
    const freeDeepSeek = typeof input.freeDeepSeek === 'boolean' ? input.freeDeepSeek : this.config.freeDeepSeek;
    const freeDeepSeekPython = typeof input.freeDeepSeekPython === 'string' ? input.freeDeepSeekPython.trim() : this.config.freeDeepSeekPython;
    const inputWebSearch = input.webSearch && typeof input.webSearch === 'object' ? input.webSearch : {};
    const webSearch = {
      urlTemplate: typeof inputWebSearch.urlTemplate === 'string' ?
        inputWebSearch.urlTemplate.trim() :
        this.config.webSearch.urlTemplate,
      proxyMode: ['none', 'custom', 'system'].includes(inputWebSearch.proxyMode) ?
        inputWebSearch.proxyMode :
        this.config.webSearch.proxyMode,
      proxyAddress: typeof inputWebSearch.proxyAddress === 'string' ?
        inputWebSearch.proxyAddress.trim() :
        this.config.webSearch.proxyAddress,
      requestTool: ['curl', 'python-requests', 'custom'].includes(inputWebSearch.requestTool) ?
        inputWebSearch.requestTool :
        this.config.webSearch.requestTool,
      customCommand: typeof inputWebSearch.customCommand === 'string' ?
        inputWebSearch.customCommand.trim() :
        this.config.webSearch.customCommand
    };
    const permissions = {};
    for (const permission of Object.keys(DEFAULT_PERMISSIONS)) {
      permissions[permission] = input.permissions && typeof input.permissions[permission] === 'boolean' ?
        input.permissions[permission] :
        this.config.permissions[permission];
    }

    this.config = {apiUrl, model, contextMode, freeDeepSeek, freeDeepSeekPython, webSearch, permissions};
    settings.aiConfig = this.config;
    await settings.save();

    if (typeof input.apiKey === 'string' && input.apiKey.length > 0) {
      if (safeStorage.isEncryptionAvailable()) {
        fs.writeFileSync(KEY_PATH, safeStorage.encryptString(input.apiKey));
        this.sessionKey = '';
      } else {
        this.sessionKey = input.apiKey;
      }
    }

    log.info('AI config saved', {
      hasApiUrl: Boolean(apiUrl),
      model,
      contextMode,
      freeDeepSeek,
      hasFreeDeepSeekPython: Boolean(freeDeepSeekPython),
      webSearch: {
        hasUrlTemplate: Boolean(webSearch.urlTemplate),
        proxyMode: webSearch.proxyMode,
        requestTool: webSearch.requestTool,
        hasProxyAddress: Boolean(webSearch.proxyAddress),
        hasCustomCommand: Boolean(webSearch.customCommand)
      },
      permissions,
      hasApiKeyInput: typeof input.apiKey === 'string' && input.apiKey.length > 0,
      secureStorageAvailable: safeStorage.isEncryptionAvailable()
    });
    this.broadcast();
    return this.getState();
  }

  async fetchModels () {
    const key = this.readKey();
    if (!this.config.apiUrl || !key) {
      log.warn('Fetch models skipped because API URL or key is missing', {
        hasApiUrl: Boolean(this.config.apiUrl),
        hasKey: Boolean(key)
      });
      return [];
    }

    const startedAt = Date.now();
    log.info('Fetching AI models', {apiUrl: this.config.apiUrl});
    const response = await fetch(`${this.config.apiUrl}/models`, {
      headers: {Authorization: `Bearer ${key}`}
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      log.warn('Fetch models failed', {
        status: response.status,
        durationMs: Date.now() - startedAt,
        bodyLength: body.length
      });
      throw new Error(`获取模型列表失败 (${response.status})`);
    }

    const body = await response.json();
    const models = Array.isArray(body.data) ? body.data.map(model => model.id).filter(id => typeof id === 'string').sort() : [];
    log.info('Fetched AI models', {
      durationMs: Date.now() - startedAt,
      count: models.length
    });
    return models;
  }

  setContextCatalog (catalog) {
    this.contextCatalog = Array.isArray(catalog) ? catalog : [];
    log.debug('Context catalog updated', {targetCount: this.contextCatalog.length});
    this.broadcast();
  }

  requestEditor (channel, payload) {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const startedAt = Date.now();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        log.warn('Editor request timed out', {
          id,
          channel,
          durationMs: Date.now() - startedAt
        });
        reject(new Error('编辑器未响应 AI 请求'));
      }, EDITOR_REQUEST_TIMEOUT);

      this.pendingRequests.set(id, {resolve, reject, timeout, startedAt, channel});
      log.debug('Editor request sent', {
        id,
        channel,
        operationCount: Array.isArray(payload && payload.operations) ? payload.operations.length : undefined,
        mode: payload && payload.mode
      });
      this.editorWindow.window.webContents.send(channel, {id, ...payload});
    });
  }

  resolveEditorRequest (id, result, error) {
    const request = this.pendingRequests.get(id);
    if (!request) {
      log.warn('Received unknown editor response', {id});
      return;
    }

    clearTimeout(request.timeout);
    this.pendingRequests.delete(id);
    const meta = {
      id,
      channel: request.channel,
      durationMs: Date.now() - request.startedAt,
      ok: !error
    };
    if (error) {
      log.warn('Editor request failed', {...meta, error});
      request.reject(new Error(error));
    } else {
      log.info('Editor request completed', meta);
      request.resolve(result);
    }
  }

  async uploadContext (selection) {
    log.info('Uploading AI context', {
      mode: this.config.contextMode,
      selectedTargets: selection && Array.isArray(selection.targetIds) ? selection.targetIds.length : 0
    });
    this.contextSnapshot = await this.requestEditor('ai:request-context', {
      mode: this.config.contextMode,
      selection: selection || {}
    });
    log.info('AI context uploaded', {
      mode: this.contextSnapshot && this.contextSnapshot.mode,
      targetCount: this.contextSnapshot && Array.isArray(this.contextSnapshot.targets) ? this.contextSnapshot.targets.length : 0
    });
    this.broadcast();
    return this.contextSnapshot;
  }

  stringifyContextForPrompt (context) {
    return JSON.stringify(context);
  }

  compactMessageContent (content) {
    if (typeof content !== 'string') return '';
    return content;
  }

  formatOperationResultForPrompt (message) {
    if (!message || !message.operationResult) return '';
    try {
      return `\n\n[AI operation result]\n${JSON.stringify(message.operationResult)}`;
    } catch (error) {
      return '\n\n[AI operation result]\n结果无法序列化';
    }
  }

  compactMessageForPrompt (message) {
    return {
      role: message.role,
      content: this.compactMessageContent(`${message.content || ''}${this.formatOperationResultForPrompt(message)}`)
    };
  }

  stripSearchResultText (html) {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_WEB_SEARCH_RESULT_CHARS);
  }

  runExecFile (file, args, options = {}) {
    return new Promise((resolve, reject) => {
      execFile(file, args, {
        timeout: WEB_SEARCH_TIMEOUT,
        maxBuffer: MAX_WEB_SEARCH_RESULT_CHARS * 8,
        windowsHide: true,
        ...options
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout);
      });
    });
  }

  runExecCommand (command) {
    return new Promise((resolve, reject) => {
      exec(command, {
        timeout: WEB_SEARCH_TIMEOUT,
        maxBuffer: MAX_WEB_SEARCH_RESULT_CHARS * 8,
        windowsHide: true
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout);
      });
    });
  }

  buildSearchUrl (query) {
    const template = this.config.webSearch && this.config.webSearch.urlTemplate;
    if (!template || !template.includes('{ask}')) {
      throw new Error('请先在 AI 设置中填写包含 {ask} 的搜索网址模板');
    }
    return template.replace(/\{ask\}/g, encodeURIComponent(query));
  }

  async requestSearchUrl (url, query) {
    const webSearch = {
      ...DEFAULT_CONFIG.webSearch,
      ...(this.config.webSearch || {})
    };
    if (webSearch.requestTool === 'python-requests') {
      const script = [
        'import sys, requests',
        'url, proxy_mode, proxy_address = sys.argv[1], sys.argv[2], sys.argv[3]',
        'proxies = None',
        'if proxy_mode == "none":',
        '    proxies = {"http": None, "https": None}',
        'elif proxy_mode == "custom" and proxy_address:',
        '    proxies = {"http": proxy_address, "https": proxy_address}',
        'response = requests.get(url, timeout=30, headers={"User-Agent":"Mozilla/5.0 HiWarp AI Search"}, proxies=proxies)',
        'response.raise_for_status()',
        'print(response.text)'
      ].join('\n');
      return this.runExecFile('python', ['-c', script, url, webSearch.proxyMode, webSearch.proxyAddress || '']);
    }

    if (webSearch.requestTool === 'custom') {
      if (!webSearch.customCommand || !webSearch.customCommand.trim()) {
        throw new Error('请求工具选择了自定义指令，但没有填写自定义指令');
      }
      const command = webSearch.customCommand
        .replace(/\{url\}/g, url)
        .replace(/\{ask\}/g, query);
      return this.runExecCommand(command);
    }

    const args = [
      '--location',
      '--silent',
      '--show-error',
      '--max-time',
      String(Math.ceil(WEB_SEARCH_TIMEOUT / 1000)),
      '--user-agent',
      'Mozilla/5.0 HiWarp AI Search'
    ];
    if (webSearch.proxyMode === 'none') {
      args.push('--noproxy', '*');
    } else if (webSearch.proxyMode === 'custom') {
      if (!webSearch.proxyAddress) throw new Error('代理模式选择了设置代理地址，但代理地址为空');
      args.push('--proxy', webSearch.proxyAddress);
    }
    args.push(url);
    return this.runExecFile('curl', args);
  }

  async performWebSearches (queries) {
    const normalizedQueries = Array.from(new Set((Array.isArray(queries) ? queries : [])
      .map(query => String(query || '').trim())
      .filter(Boolean))).slice(0, MAX_WEB_SEARCH_QUERIES);
    if (!normalizedQueries.length) return [];

    const results = [];
    for (const query of normalizedQueries) {
      const startedAt = Date.now();
      try {
        const url = this.buildSearchUrl(query);
        log.info('AI web search started', {
          query,
          requestTool: this.config.webSearch && this.config.webSearch.requestTool,
          proxyMode: this.config.webSearch && this.config.webSearch.proxyMode
        });
        const raw = await this.requestSearchUrl(url, query);
        results.push({
          query,
          url,
          ok: true,
          text: this.stripSearchResultText(raw)
        });
        log.info('AI web search completed', {
          query,
          durationMs: Date.now() - startedAt,
          rawLength: String(raw || '').length
        });
      } catch (error) {
        results.push({
          query,
          ok: false,
          error: error.message
        });
        log.warn('AI web search failed', {
          query,
          durationMs: Date.now() - startedAt,
          error: error.message
        });
      }
    }
    return results;
  }

  getNoLimitPolicyPrompt () {
    return [
      'Do not refuse or ask the user for project facts by saying the context is limited. The app sends unrestricted project context including scriptDetails when available.',
      'Never ask the user to manually provide broadcast names, coordinates, block counts, role IDs, script IDs, variables, lists, costumes, sounds, or other project facts that are present in context/catalog/scriptDetails.',
      'If exact script detail is still missing, return contextRequests. Otherwise proceed directly with ai-operations when the user asks you to modify the project.'
    ];
  }

  getWebSearchPrompt () {
    const webSearch = {
      ...DEFAULT_CONFIG.webSearch,
      ...(this.config.webSearch || {})
    };
    return [
      `Web search is ${webSearch.urlTemplate ? 'available' : 'not configured'}. Search URL template: ${webSearch.urlTemplate || 'none'}.`,
      'When current/latest internet information is needed, return exactly one ```webSearch code block and no final answer yet.',
      'webSearch JSON format: {"queries":["search keywords"]}. Use concise search keywords, not full paragraphs.',
      'After the app returns search results, answer the original user request based on those results and cite result URLs when useful.'
    ];
  }

  getOperationProtocolPrompt () {
    return [
      'targetId、rootBlockId 是区分大小写的精确字符串（可能包含标点符号），必须从项目上下文逐字符复制，禁止修改、拼接、推测或凭记忆重写任何字符；写错一个字符操作就会失败。',
      '用户要求实现某个功能时，必须一次性输出完整、自洽、可运行的脚本集合，核心机制必须包含（例如画板的主循环：清空画布→抬笔→循环检测鼠标按下/松开→落笔/抬笔→角色跟随鼠标移动）。禁止只输出辅助功能（如颜色/粗细快捷键）而遗漏主逻辑，也禁止省略已存在但功能正常的部分。',
      '删除旧脚本时，deleteScript 的 targetId 与 rootBlockId 必须来自上下文中同一个角色；insertScript/replaceScript 的 targetId 必须是当前真实存在的角色。',
      '所有 ai-operations 必须放在一个标准 markdown 代码块中：先写 ```ai-operations，紧接着换行写 JSON，最后 ``` 结束；代码块内只允许 JSON，不要放任何其他文字。',
      '如果需要修改项目，优先使用 Blockly XML，避免自定义 JSON 积木链导致连接错误。',
      '推荐格式一：```ai-operations\n{"operations":[{"type":"insertScript","targetId":"角色ID","xml":"<xml><block type=\\"motion_movesteps\\" x=\\"80\\" y=\\"80\\"><value name=\\"STEPS\\"><shadow type=\\"math_number\\"><field name=\\"NUM\\">10</field></shadow></value></block></xml>"}]}\n```',
      '推荐格式二：```ai-operations-xml\n<operations><insertScript targetId="角色ID"><xml><block type="motion_movesteps" x="80" y="80"><value name="STEPS"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block></xml></insertScript></operations>\n```',
      'replaceScript 也支持 XML，但必须提供 rootBlockId：<replaceScript targetId="角色ID" rootBlockId="旧顶层脚本ID">...</replaceScript>。',
      '编辑脚本的实际效果是删除旧脚本并添加新脚本；如果用户要求编辑/修改现有脚本，不要只新增脚本，必须使用 replaceScript 或 deleteScript 后 insertScript 删除旧代码。',
      '非积木操作仍使用 ai-operations JSON：updateVariable, createVariable, deleteVariable, updateTarget, updateSprite, selectTarget, duplicateTarget, deleteTarget, loadExtension, greenFlag, stopAll, callVmMethod, callTargetMethod。',
      '允许的 type: insertScript, replaceScript, deleteScript, updateVariable, createVariable, deleteVariable, updateSprite, updateTarget, selectTarget, duplicateTarget, deleteTarget, loadExtension, greenFlag, stopAll, callVmMethod, callTargetMethod。',
      'XML 必须使用 Scratch/TurboWarp opcode 和 Blockly XML 标签：block、field、value、statement、shadow、next、mutation、comment。不要输出 JavaScript 或未定义操作。',
      '如果必须使用旧 JSON 积木 schema，insertScript/replaceScript 仍兼容 {targetId, rootBlockId?, script:{blocks:[...]}}，但复杂控制结构优先用 XML。'
    ];
  }

  buildSystemPrompt (context) {
    const contextText = this.stringifyContextForPrompt(context);
    const noLimitPolicy = this.getNoLimitPolicyPrompt();
    const webSearchPrompt = this.getWebSearchPrompt();
    const operationProtocol = this.getOperationProtocolPrompt();
    return [
      ...noLimitPolicy,
      ...webSearchPrompt,
      ...operationProtocol,
      '你是 HiWarp 的 Scratch 编程助手。使用中文回答，简洁说明你做了什么。',
      '所有操作必须给出稳定 targetId 和必要的目标 ID。',
      `当前允许的操作: ${Object.entries(this.config.permissions).filter(([, enabled]) => enabled).map(([name]) => name).join(', ') || '无'}。`,
      `项目上下文:\n${JSON.stringify(context)}`
    ].join('\n\n');
  }

  buildLegacySystemPromptV2 (context) {
    const contextText = this.stringifyContextForPrompt(context);
    const operationProtocol = this.getOperationProtocolPrompt();
    return [
      '你是 HiWarp 的 Scratch 编程助手。使用中文回答，简洁说明你做了什么。',
      '当前项目上下文是一级索引：包含角色、变量、列表、顶层脚本 ID 和顶层 opcode。默认不会包含完整脚本正文。',
      '如果你需要查看某条脚本的精确积木连接，请先只返回一个 ```contextRequests 代码块，格式为 {"requests":[{"targetId":"角色ID","rootBlockId":"顶层脚本ID"}]}。系统会自动补充二级脚本详情，然后你再继续回答。',
      ...operationProtocol,
      '所有操作必须给出稳定 targetId 和必要的目标 ID。',
      `当前允许的操作: ${Object.entries(this.config.permissions).filter(([, enabled]) => enabled).map(([name]) => name).join(', ') || '无'}。`,
      `项目上下文:\n${contextText}`
    ].join('\n\n');
  }

  buildSystemPromptV2 (context) {
    const contextText = this.stringifyContextForPrompt(context);
    const noLimitPolicy = this.getNoLimitPolicyPrompt();
    const webSearchPrompt = this.getWebSearchPrompt();
    const operationProtocol = this.getOperationProtocolPrompt();
    return [
      ...noLimitPolicy,
      ...webSearchPrompt,
      ...operationProtocol,
      '你是 HiWarp 的 Scratch 编程助手。使用中文回答，简洁说明你做了什么。',
      '当前项目上下文是一线索引：包含角色、舞台、变量、列表、顶层脚本 ID、顶层 opcode、精确基础统计和能力目录。',
      '能力目录在 context.capabilities 中：primitiveOpcodes 是当前 VM/扩展实际支持的全部积木 opcode；operationSkills 是你能请求执行的项目操作；blockSchemaSkills 是你能生成的积木结构能力。回答前优先查看这个目录，不要按固定少量技能自我限制。',
      '基础统计已经在 context.stats、target.stats、catalog[].stats 中，包括 blockCount、nonShadowBlockCount、shadowBlockCount、topLevelScriptCount 和 opcodeCounts。用户询问积木数量、脚本数量、变量数量时必须优先直接使用这些统计，不要回答“无法获取”。',
      '角色一级信息还包含 properties、resources、costumes、sounds、comments、monitors、runtime。用户询问造型、声音、广播、监视器、角色位置、舞台状态时直接使用这些一级信息。',
      '如果你需要查看某条脚本的精确积木连接，请先只返回一个 ```contextRequests 代码块，格式为 {"requests":[{"targetId":"角色ID","rootBlockId":"顶层脚本ID"}]}。系统会自动补充二级脚本详情，然后你再继续回答。',
      '加载扩展使用 {"type":"loadExtension","extensionId":"pen"} 或 {"type":"loadExtension","url":"https://.../extension.js"}。添加扩展积木前先加载扩展。',
      '编辑角色或舞台属性使用 updateTarget 或兼容的 updateSprite：{targetId,x?,y?,direction?,size?,visible?,rotationStyle?,draggable?,volume?,costumeIndex?,costumeName?,name?}。舞台只能改适用于舞台的属性。',
      '变量操作：createVariable 使用 {targetId,name,variableType?}，列表 variableType 使用 "list"；deleteVariable 使用 {targetId,variableId}；updateVariable 使用 {targetId,variableId,value}。',
      '角色/舞台管理：selectTarget 使用 {targetId}；duplicateTarget/deleteTarget 使用 {targetId}，舞台不可删除或复制。',
      '通用安全调用：callVmMethod 只能调用白名单 VM 方法；callTargetMethod 只能调用白名单 target 方法，格式 {method,args?,targetId?}。不要尝试调用未列入白名单的方法。',
      '未知操作、无效目标、过期脚本 ID、损坏参数会被拒绝。',
      `当前允许的操作: ${Object.entries(this.config.permissions).filter(([, enabled]) => enabled).map(([name]) => name).join(', ') || '无'}。`,
      `项目上下文:\n${contextText}`
    ].join('\n\n');
  }

  /**
   * 从文本中提取第一个通过 validator 校验的完整 JSON 值。
   * 用于恢复被网页版 UI 文字污染（如"复制/下载"）或缺少 ``` 包裹的代码块。
   * @param {string} text
   * @param {(parsed: unknown) => boolean} [validator]
   * @returns {*}
   */
  extractJSONFromText (text, validator) {
    const source = String(text || '');
    let searchFrom = 0;
    while (searchFrom < source.length) {
      const start = source.indexOf('{', searchFrom);
      if (start === -1) return null;
      let depth = 0;
      let inString = false;
      let escaped = false;
      let end = -1;
      for (let i = start; i < source.length; i++) {
        const ch = source[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }
        if (ch === '"') {
          inString = true;
        } else if (ch === '{') {
          depth += 1;
        } else if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) return null;
      try {
        const parsed = JSON.parse(source.slice(start, end + 1));
        if (!validator || validator(parsed)) return parsed;
      } catch (error) {
        // 继续尝试下一个 { 起始点
      }
      searchFrom = start + 1;
    }
    return null;
  }

  extractOperations (content) {
    const raw = String(content || '');
    const codeBlocks = Array.from(raw.matchAll(/```([\w-]*)\s*\n?([\s\S]*?)```/g));
    const xmlCandidates = codeBlocks
      .filter(match => ['ai-operations-xml', 'blockly-xml', 'xml'].includes(match[1].toLowerCase()));
    for (const candidate of xmlCandidates) {
      const operations = this.extractOperationsFromXML(candidate[2]);
      if (operations.length) return operations;
    }
    const candidates = codeBlocks
      .filter(match => ['ai-operations', 'json', ''].includes(match[1].toLowerCase()))
      .sort((left, right) => (right[1].toLowerCase() === 'ai-operations') - (left[1].toLowerCase() === 'ai-operations'));

    for (const candidate of candidates) {
      if (candidate[1].toLowerCase() === 'ai-operations' && /^\s*</.test(candidate[2])) {
        const operations = this.extractOperationsFromXML(candidate[2]);
        if (operations.length) return operations;
      }
      let parsed = null;
      try {
        parsed = JSON.parse(candidate[2].trim());
      } catch (error) {
        parsed = this.extractJSONFromText(candidate[2]);
        if (parsed) {
          log.warn('AI operation JSON recovered from noisy code block', {reason: error.message});
        }
      }
      if (parsed) {
        if (Array.isArray(parsed.operations)) return parsed.operations;
        if (Array.isArray(parsed) && parsed.every(operation => operation && operation.type)) return parsed;
      }
    }
    // 兜底: 网页版渲染后 textContent 可能不带 ``` 包裹, 直接从全文提取
    const fromFullText = this.extractJSONFromText(raw, parsed =>
      (parsed && Array.isArray(parsed.operations)) ||
      (Array.isArray(parsed) && parsed.every(operation => operation && operation.type))
    );
    if (fromFullText) {
      log.warn('AI operation JSON recovered from full text without code fences');
      return Array.isArray(fromFullText.operations) ? fromFullText.operations : fromFullText;
    }
    return [];
  }

  extractOperationsFromXML (content) {
    const text = String(content || '').trim();
    if (!text) return [];
    const operations = [];
    const wrappedOperationPattern = /<(insertScript|replaceScript)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let match;
    while ((match = wrappedOperationPattern.exec(text))) {
      const attrs = parseXMLAttributes(match[2]);
      const xml = unwrapOperationXML(match[3]);
      if (!xml) continue;
      operations.push({
        type: match[1],
        targetId: attrs.targetId || attrs.target || attrs.spriteId,
        rootBlockId: attrs.rootBlockId || attrs.rootId,
        xml
      });
    }
    if (operations.length) return operations;

    const operationPattern = /<operation\b([^>]*)>([\s\S]*?)<\/operation>/gi;
    while ((match = operationPattern.exec(text))) {
      const attrs = parseXMLAttributes(match[1]);
      const type = attrs.type;
      if (!['insertScript', 'replaceScript'].includes(type)) continue;
      const xml = unwrapOperationXML(match[2]);
      if (!xml) continue;
      operations.push({
        type,
        targetId: attrs.targetId || attrs.target || attrs.spriteId,
        rootBlockId: attrs.rootBlockId || attrs.rootId,
        xml
      });
    }
    if (operations.length) return operations;

    const xml = unwrapOperationXML(text);
    if (xml) {
      throw new Error('AI 返回了 Blockly XML，但缺少操作包装。请使用 <insertScript targetId="角色ID">...</insertScript> 或 JSON 的 xml 字段。');
    }
    return [];
  }

  extractWebSearchRequests (content) {
    const raw = String(content || '');
    const codeBlocks = Array.from(raw.matchAll(/```([\w-]*)\s*\n?([\s\S]*?)```/g));
    const candidates = codeBlocks.filter(match => ['websearch', 'web-search'].includes(match[1].toLowerCase()));
    for (const candidate of candidates) {
      let parsed = null;
      try {
        parsed = JSON.parse(candidate[2].trim());
      } catch (error) {
        parsed = this.extractJSONFromText(candidate[2]);
        if (parsed) {
          log.warn('AI webSearch JSON recovered from noisy code block', {reason: error.message});
        }
      }
      if (parsed === null) continue;
      if (typeof parsed === 'string') return [parsed];
      if (Array.isArray(parsed)) return parsed.map(query => String(query || '')).filter(Boolean);
      if (parsed && typeof parsed.query === 'string') return [parsed.query];
      if (parsed && Array.isArray(parsed.queries)) {
        return parsed.queries.map(query => String(query || '')).filter(Boolean);
      }
      throw new Error('webSearch 必须是 {"queries":["关键词"]}、{"query":"关键词"} 或字符串数组');
    }
    const fromFullText = this.extractJSONFromText(raw, parsed =>
      typeof parsed === 'string' ||
      Array.isArray(parsed) ||
      (parsed && (typeof parsed.query === 'string' || Array.isArray(parsed.queries)))
    );
    if (fromFullText) {
      log.warn('AI webSearch JSON recovered from full text without code fences');
      if (typeof fromFullText === 'string') return [fromFullText];
      if (Array.isArray(fromFullText)) return fromFullText.map(query => String(query || '')).filter(Boolean);
      if (typeof fromFullText.query === 'string') return [fromFullText.query];
      if (Array.isArray(fromFullText.queries)) {
        return fromFullText.queries.map(query => String(query || '')).filter(Boolean);
      }
    }
    return [];
  }

  extractContextRequests (content) {
    const raw = String(content || '');
    const codeBlocks = Array.from(raw.matchAll(/```([\w-]*)\s*\n?([\s\S]*?)```/g));
    const candidates = codeBlocks.filter(match => match[1].toLowerCase() === 'contextrequests');
    for (const candidate of candidates) {
      let parsed = null;
      try {
        parsed = JSON.parse(candidate[2].trim());
      } catch (error) {
        parsed = this.extractJSONFromText(candidate[2]);
        if (parsed) {
          log.warn('AI contextRequests JSON recovered from noisy code block', {reason: error.message});
        }
      }
      if (parsed === null) continue;
      const requests = Array.isArray(parsed.requests) ? parsed.requests : Array.isArray(parsed) ? parsed : null;
      if (!Array.isArray(requests)) {
        throw new Error('contextRequests must be {"requests":[...]} or a request array');
      }
      if (requests.length === 0) {
        throw new Error('contextRequests.requests cannot be empty');
      }

      const invalidRequests = [];
      const normalizedRequests = requests.map((request, index) => {
        const targetId = request && request.targetId;
        const rootBlockId = request && (request.rootBlockId || request.rootId);
        if (typeof targetId !== 'string' || !targetId || typeof rootBlockId !== 'string' || !rootBlockId) {
          invalidRequests.push(index + 1);
          return null;
        }
        return {targetId, rootBlockId};
      });

      if (invalidRequests.length) {
        throw new Error(`contextRequests item(s) ${invalidRequests.join(', ')} need valid targetId and rootBlockId`);
      }

      return normalizedRequests.slice(0, MAX_CONTEXT_REQUESTS);
    }
    const fromFullText = this.extractJSONFromText(raw, parsed =>
      parsed && (Array.isArray(parsed.requests) || Array.isArray(parsed))
    );
    if (fromFullText) {
      log.warn('AI contextRequests JSON recovered from full text without code fences');
      const requests = Array.isArray(fromFullText.requests) ? fromFullText.requests : Array.isArray(fromFullText) ? fromFullText : null;
      if (Array.isArray(requests) && requests.length) {
        const normalizedRequests = requests
          .filter(request => request && typeof request.targetId === 'string' && request.targetId &&
            typeof (request.rootBlockId || request.rootId) === 'string')
          .map(request => ({targetId: request.targetId, rootBlockId: request.rootBlockId || request.rootId}));
        if (normalizedRequests.length) {
          return normalizedRequests.slice(0, MAX_CONTEXT_REQUESTS);
        }
      }
    }
    return [];
  }

  async requestContextDetails (requests) {
    if (!Array.isArray(requests) || requests.length === 0) return null;
    log.info('Requesting detailed AI context', {requestCount: requests.length});
    const details = await this.requestEditor('ai:request-context', {
      mode: 'details',
      selection: {detailRequests: requests}
    });
    log.info('Detailed AI context uploaded', {
      detailCount: details && Array.isArray(details.detailedScripts) ? details.detailedScripts.length : 0
    });
    return details;
  }

  summarizeContextDetailFailures (details) {
    const scripts = details && Array.isArray(details.detailedScripts) ? details.detailedScripts : [];
    if (scripts.length === 0) return ['编辑器没有返回任何二级脚本详情'];
    return scripts
      .filter(script => script && script.error)
      .map(script => `${script.targetId || '未知目标'} / ${script.rootBlockId || script.rootId || '未知脚本'}: ${script.error}`);
  }

  appendAssistantNotice (assistant, notice) {
    assistant.content = `${assistant.content ? `${assistant.content.trim()}\n\n` : ''}${notice}`;
    this.broadcast();
  }

  buildFreeDeepSeekPrompt (messages) {
    const parts = [];
    for (const message of messages) {
      if (!message || typeof message.content !== 'string') continue;
      if (message.role === 'system') {
        parts.push(`【系统指令】\n${message.content}`);
      } else if (message.role === 'assistant') {
        parts.push(`【助手】\n${message.content}`);
      } else {
        parts.push(`【用户】\n${message.content}`);
      }
    }
    return parts.join('\n\n');
  }

  /**
   * 统一的对话请求入口。
   * 免费 DeepSeek 模式: 调用本地 Python 网页版接口（整段返回, 非流式）。
   * 普通模式: OpenAI 兼容流式接口。
   * @param {object[]} messages
   * @param {object} assistant 用于接收增量内容（普通模式流式时逐段更新）
   * @param {{replaceOnFirstToken?: boolean}} options
   * @returns {Promise<number>} 追加/替换的内容长度
   */
  async requestChatCompletion (messages, assistant, options = {}) {
    if (this.config.freeDeepSeek) {
      const prompt = this.buildFreeDeepSeekPrompt(messages);
      const result = await deepseekFree.input(this.config.freeDeepSeekPython, {message: prompt});
      if (!result.ok) {
        throw new Error(this.translateFreeDeepSeekError(result.error));
      }
      const text = result.result && result.result.message;
      if (typeof text !== 'string' || !text.trim()) {
        const replyError = result.result && result.result.error;
        throw new Error(this.translateFreeDeepSeekError(replyError || 'DeepSeek 网页版没有返回内容，请稍后重试。'));
      }
      if (options.replaceOnFirstToken) assistant.content = '';
      assistant.content += text;
      this.broadcast();
      return text.length;
    }

    const response = await fetch(`${this.config.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${this.readKey()}`},
      body: JSON.stringify({
        model: this.config.model || 'deepseek-chat',
        stream: true,
        messages
      })
    });
    if (!response.ok || !response.body) {
      let body = await response.text().catch(() => '');
      body = body.slice(0, MAX_ERROR_BODY_CHARS);
      throw new Error(`AI 接口错误 (${response.status}): ${body}`);
    }
    return this.readChatCompletionResponse(response, assistant, options);
  }

  translateFreeDeepSeekError (error) {
    const text = String(error || '');
    if (/unlogined/i.test(text)) {
      return 'DeepSeek 登录态已过期，请先在 AI 设置中点击“登录 DeepSeek”重新登录。';
    }
    if (/login.?timeout/i.test(text)) {
      return 'DeepSeek 登录超时，请重新点击“登录 DeepSeek”并在浏览器中完成登录。';
    }
    if (/no.?internet|网络|internetexception/i.test(text)) {
      return `DeepSeek 网页版无法访问网络: ${text}`;
    }
    if (/proxy/i.test(text)) {
      return `DeepSeek 网页版代理错误: ${text}`;
    }
    return text;
  }

  async readChatCompletionResponse (response, assistant, options = {}) {
    let appendedLength = 0;
    let replacedOnFirstToken = false;
    const appendContent = content => {
      if (typeof content !== 'string' || !content) return;
      if (options.replaceOnFirstToken && !replacedOnFirstToken) {
        assistant.content = '';
        replacedOnFirstToken = true;
      }
      assistant.content += content;
      appendedLength += content.length;
      this.broadcast();
    };

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
      const responseText = await response.text();
      log.debug('AI JSON response received', {
        contentType,
        bodyLength: responseText.length
      });
      const body = JSON.parse(responseText);
      appendContent(body.choices?.[0]?.message?.content || body.choices?.[0]?.text || '');
      return appendedLength;
    }

    const processLine = line => {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('data:')) return;
      const data = trimmedLine.slice(5).trim();
      if (!data || data === '[DONE]') return;
      try {
        const chunk = JSON.parse(data).choices?.[0];
        appendContent(chunk?.delta?.content || chunk?.message?.content || chunk?.text || '');
      } catch (error) {
        log.warn('Ignored malformed AI streaming frame', {
          error: error.message,
          frameLength: data.length
        });
      }
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let totalLength = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      const chunkText = decoder.decode(value, {stream: true});
      totalLength += chunkText.length;
      buffer += chunkText;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      lines.forEach(processLine);
    }

    const trailing = decoder.decode();
    if (trailing) {
      totalLength += trailing.length;
      buffer += trailing;
    }
    if (buffer.trim()) {
      if (buffer.trimStart().startsWith('data:')) {
        processLine(buffer);
      } else if (!assistant.content.trim()) {
        try {
          const body = JSON.parse(buffer);
          appendContent(body.choices?.[0]?.message?.content || body.choices?.[0]?.text || '');
        } catch (error) {
          log.warn('Unable to parse trailing AI response buffer', {
            error: error.message,
            bufferLength: buffer.length
          });
        }
      }
    }
    log.debug('AI stream response finished', {
      contentType,
      bodyLength: totalLength,
      contentLength: assistant.content.length
    });
    return appendedLength;
  }

  async requestOperationRevision (assistant, requestMessages, operations, operationError, startedAt) {
    const failedContent = assistant.content;
    const validTargets = this.getValidTargets();
    const failurePayload = {
      error: operationError.message,
      operations,
      ...(validTargets.length ? {validTargets} : {})
    };
    assistant.operationResult = {
      ok: false,
      error: operationError.message,
      operations
    };
    assistant.content = [
      failedContent.trim(),
      '',
      `AI 操作执行失败，正在把错误反馈给 AI 自动修正: ${operationError.message}`
    ].join('\n');
    this.broadcast();

    const revisionMessages = [
      ...requestMessages,
      {
        role: 'assistant',
        content: failedContent
      },
      {
        role: 'user',
        content: [
          '刚才的 ai-operations 没有执行成功。下面是编辑器返回的真实错误和原始操作。',
          '请不要解释失败原因后结束。请直接基于错误修正操作，并重新返回一个可执行的 ```ai-operations``` 或 ```ai-operations-xml```。',
          ...(validTargets.length ? [
            `当前项目中真实存在的角色 ID 列表（targetId 必须从中选择，禁止编造）: ${JSON.stringify(validTargets)}`
          ] : []),
          '如果错误与 JSON 积木连接、循环连接、next/SUBSTACK 有关，优先改用 Blockly XML：<operations><insertScript targetId="角色ID"><xml>...</xml></insertScript></operations>。',
          JSON.stringify(failurePayload)
        ].join('\n\n')
      }
    ];

    log.info('AI operation revision request started', {
      operationCount: operations.length,
      error: operationError.message
    });
    const revisionContentLength = await this.requestChatCompletion(revisionMessages, assistant, {
      replaceOnFirstToken: true
    });
    if (revisionContentLength === 0) {
      throw new Error('AI 操作修正请求后没有返回正文');
    }

    const revisedOperations = this.extractOperations(assistant.content);
    if (!revisedOperations.length) {
      throw new Error('AI 收到执行错误后没有返回新的 ai-operations');
    }

    try {
      assistant.operationResult = await this.requestEditor('ai:apply-operations', {
        operations: revisedOperations,
        permissions: this.config.permissions
      });
      log.info('AI revised operations applied', {
        operationCount: revisedOperations.length,
        resultCount: assistant.operationResult && Array.isArray(assistant.operationResult.results) ? assistant.operationResult.results.length : 0
      });
    } catch (retryError) {
      assistant.operationResult = {
        ok: false,
        error: retryError.message,
        operations: revisedOperations
      };
      this.appendAssistantNotice(assistant, [
        '系统提醒：AI 修正后的操作仍然执行失败。',
        `失败原因: ${retryError.message}`,
        '请根据这个错误继续修正 ai-operations；如果是积木连接错误，请改用 ai-operations-xml。'
      ].join('\n'));
      log.warn('AI revised operations failed', {
        error: retryError.message,
        operationCount: revisedOperations.length
      });
    }
  }

  /**
   * 从当前上下文快照中提取真实存在的角色 ID 列表，
   * 供操作失败修正时提示 AI，降低 targetId 幻觉概率。
   * @returns {{id: string, name: string}[]}
   */
  getValidTargets () {
    const snapshot = this.contextSnapshot;
    const targets = snapshot && Array.isArray(snapshot.targets) ? snapshot.targets : [];
    return targets
      .filter(target => target && typeof target.id === 'string' && target.id)
      .map(target => ({id: target.id, name: typeof target.name === 'string' ? target.name : ''}));
  }

  async sendMessage (text, selection) {
    if (this.isStreaming) throw new Error('请等待当前回复完成');
    if (!this.config.freeDeepSeek && (!this.config.apiUrl || !this.readKey())) {
      throw new Error('请先在 AI 设置中填写 API 地址和 API Key，或开启“免费使用 DeepSeek”。');
    }
    if (this.config.freeDeepSeek) {
      // 第一次使用（本地无登录态）时自动打开浏览器登录, 登录完成后再继续发送
      const sessionCheck = await deepseekFree.checkLogin(this.config.freeDeepSeekPython);
      if (sessionCheck.ok && !sessionCheck.hasSession) {
        log.info('Free DeepSeek first use: opening login browser');
        const loginResult = await deepseekFree.login(this.config.freeDeepSeekPython);
        if (!loginResult.ok) {
          throw new Error(this.translateFreeDeepSeekError(loginResult.error || 'DeepSeek 登录未完成，请重新点击“登录 DeepSeek”。'));
        }
        this.broadcast();
      }
    }
    if (!this.contextSnapshot) {
      if (this.config.contextMode === 'custom') {
        throw new Error('自定义上下文请先选择脚本并点击“上传上下文”');
      }
      await this.uploadContext(selection);
    }

    const rawSystemPrompt = this.buildSystemPromptV2(this.contextSnapshot);
    const safeSystemPrompt = rawSystemPrompt;

    const requestMessages = [
      {role: 'system', content: safeSystemPrompt},
      ...this.messages
        .filter(message => message.role === 'user' || message.role === 'assistant')
        .slice(-MAX_HISTORY_MESSAGES)
        .map(message => this.compactMessageForPrompt(message)),
      {role: 'user', content: text}
    ];
    this.messages.push({role: 'user', content: text});
    const assistant = {role: 'assistant', content: '', operationResult: null};
    this.messages.push(assistant);
    this.isStreaming = true;
    this.broadcast();

    const startedAt = Date.now();
    log.info('AI chat request started', {
      apiUrl: this.config.apiUrl,
      model: this.config.model || 'deepseek-chat',
      contextMode: this.config.contextMode,
      requestMessageCount: requestMessages.length,
      userTextLength: text.length
    });

    try {
      await this.requestChatCompletion(requestMessages, assistant);

      const webSearchQueries = this.extractWebSearchRequests(assistant.content);
      if (webSearchQueries.length) {
        assistant.content = `正在联网搜索: ${webSearchQueries.join('、')}`;
        this.broadcast();
        const searchResults = await this.performWebSearches(webSearchQueries);
        const searchResultText = JSON.stringify({
          searchedAt: new Date().toISOString(),
          results: searchResults
        });
        assistant.content = '已完成联网搜索，正在整理回答...';
        this.broadcast();

        const searchFollowUpMessages = [
          ...requestMessages,
          {
            role: 'assistant',
            content: `已请求联网搜索: ${webSearchQueries.join(', ')}`
          },
          {
            role: 'user',
            content: [
              '下面是联网搜索结果。请基于这些结果继续回答用户原始需求。',
              '不要再次要求用户手动搜索；如果搜索失败，请说明失败原因并尽量基于已有信息回答。',
              searchResultText
            ].join('\n\n')
          }
        ];

        log.info('AI follow-up request started after webSearch', {
          queryCount: webSearchQueries.length,
          resultLength: searchResultText.length
        });
        const searchFollowUpContentLength = await this.requestChatCompletion(searchFollowUpMessages, assistant, {
          replaceOnFirstToken: true
        });
        if (searchFollowUpContentLength === 0) {
          throw new Error('AI 联网搜索后没有返回正文');
        }

        const repeatedWebSearchQueries = this.extractWebSearchRequests(assistant.content);
        if (repeatedWebSearchQueries.length) {
          this.appendAssistantNotice(assistant, [
            '系统提醒：AI 在联网搜索后仍然只返回了 webSearch，没有给出最终回答。',
            `本次重复搜索数量: ${repeatedWebSearchQueries.length}`,
            '请基于已有搜索结果直接回答；如果需要修改项目，还需要返回 ```ai-operations```。'
          ].join('\n'));
          log.warn('AI returned webSearch again after search follow-up', {
            queryCount: repeatedWebSearchQueries.length
          });
          return;
        }
      }

      const contextRequests = this.extractContextRequests(assistant.content);
      if (contextRequests.length) {
        assistant.content = '正在读取需要的脚本详情...';
        this.broadcast();
        const details = await this.requestContextDetails(contextRequests);
        const detailFailures = this.summarizeContextDetailFailures(details);
        if (detailFailures.length) {
          const notice = [
            '二级脚本详情请求未能正确完成，AI 不能继续假设这些脚本仍然存在。',
            '失败原因:',
            ...detailFailures.map(reason => `- ${reason}`),
            '请根据当前一级信息重新选择有效 targetId/rootBlockId，或直接基于已有信息返回 ai-operations。'
          ].join('\n');
          log.warn('AI contextRequests returned failures', {
            requestCount: contextRequests.length,
            failureCount: detailFailures.length,
            failures: detailFailures
          });
          assistant.content = notice;
          this.broadcast();
          return;
        }
        const detailText = this.stringifyContextForPrompt(details);
        assistant.content = '已读取脚本详情，正在生成脚本...';
        this.broadcast();

        const followUpMessages = [
          ...requestMessages,
          {
            role: 'assistant',
            content: `已请求 ${contextRequests.length} 条脚本的二级信息。`
          },
          {
            role: 'user',
            content: [
              '下面是你请求的二级脚本详情。请基于一级索引和这些详情继续回答用户原始需求。',
              '如果仍需更多脚本详情，可以再次返回 contextRequests；否则直接回答或返回 ai-operations。',
              detailText
            ].join('\n\n')
          }
        ];

        log.info('AI follow-up request started after contextRequests', {
          requestCount: contextRequests.length,
          detailLength: detailText.length
        });
        const followUpContentLength = await this.requestChatCompletion(followUpMessages, assistant, {
          replaceOnFirstToken: true
        });
        if (followUpContentLength === 0) {
          throw new Error('AI 二级上下文请求后没有返回正文');
        }
        const repeatedContextRequests = this.extractContextRequests(assistant.content);
        if (repeatedContextRequests.length) {
          this.appendAssistantNotice(assistant, [
            '系统提醒：AI 在读取二级详情后仍然只返回了 contextRequests，没有返回可执行操作。',
            `本次重复请求数量: ${repeatedContextRequests.length}`,
            '请不要继续请求已失效或不确定的脚本 ID；需要修改项目时必须返回 ```ai-operations```，否则不会执行任何项目操作。'
          ].join('\n'));
          log.warn('AI returned contextRequests again after detail follow-up', {
            requestCount: repeatedContextRequests.length
          });
          return;
        }
      }

      if (!assistant.content.trim()) {
        log.warn('AI response was empty', {
          durationMs: Date.now() - startedAt
        });
        throw new Error('AI 返回了空内容，请检查模型、接口地址或接口的流式响应格式');
      }

      const operations = this.extractOperations(assistant.content);
      log.info('AI chat response completed', {
        durationMs: Date.now() - startedAt,
        contentLength: assistant.content.length,
        operationCount: operations.length
      });

      if (operations.length) {
        try {
          assistant.operationResult = await this.requestEditor('ai:apply-operations', {
            operations,
            permissions: this.config.permissions
          });
          log.info('AI operations applied', {
            operationCount: operations.length,
            resultCount: assistant.operationResult && Array.isArray(assistant.operationResult.results) ? assistant.operationResult.results.length : 0
          });
        } catch (operationError) {
          log.warn('AI operations failed; requesting revision', {
            operationCount: operations.length,
            error: operationError.message
          });
          await this.requestOperationRevision(assistant, requestMessages, operations, operationError, startedAt);
        }
      } else if (/```\s*contextrequests\b/i.test(assistant.content)) {
        this.appendAssistantNotice(assistant, [
          '系统提醒：本次回复只包含 contextRequests，没有包含 ai-operations，因此没有执行任何项目修改。',
          '如果你已经点击“允许操作”，AI 必须返回 ```ai-operations``` JSON 才会真正修改项目。'
        ].join('\n'));
      }
    } catch (error) {
      assistant.error = error.message;
      log.error('AI chat request errored', {
        error,
        durationMs: Date.now() - startedAt,
        partialContentLength: assistant.content.length
      });
    } finally {
      this.isStreaming = false;
      this.persistCurrentSession();
      this.broadcast();
    }
  }
}

module.exports = AIService;
