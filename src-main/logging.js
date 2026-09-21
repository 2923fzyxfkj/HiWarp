const fs = require('fs');
const path = require('path');
const util = require('util');
const {app, ipcMain, shell} = require('electron');

const MAX_LOG_FILE_BYTES = 1024 * 1024 * 8;
const MAX_RENDERER_MESSAGE_LENGTH = 20000;

let initialized = false;
let consolePatched = false;
let activeLogFile = null;

const getLogDirectory = () => path.join(app.getPath('userData'), 'logs');

const getLogFile = () => {
  if (!activeLogFile) {
    const date = new Date().toISOString().slice(0, 10);
    activeLogFile = path.join(getLogDirectory(), `hiwarp-${date}.log`);
  }
  return activeLogFile;
};

const ensureLogFile = () => {
  const logDirectory = getLogDirectory();
  fs.mkdirSync(logDirectory, {recursive: true});

  const logFile = getLogFile();
  try {
    const stat = fs.statSync(logFile);
    if (stat.size > MAX_LOG_FILE_BYTES) {
      const rotated = `${logFile}.${Date.now()}.old`;
      fs.renameSync(logFile, rotated);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return logFile;
};

const serializeError = error => {
  if (!error) return error;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return error;
};

const normalizeMeta = meta => {
  if (meta instanceof Error) return serializeError(meta);
  if (!meta || typeof meta !== 'object') return meta;

  const result = Array.isArray(meta) ? [] : {};
  for (const [key, value] of Object.entries(meta)) {
    if (/api[-_ ]?key|authorization|token|secret|password/i.test(key)) {
      result[key] = '[redacted]';
    } else if (value instanceof Error) {
      result[key] = serializeError(value);
    } else if (value && typeof value === 'object') {
      result[key] = normalizeMeta(value);
    } else {
      result[key] = value;
    }
  }
  return result;
};

const formatMessage = value => {
  if (typeof value === 'string') return value;
  return util.inspect(value, {depth: 6, breakLength: 160});
};

const write = (level, scope, message, meta) => {
  const safeLevel = String(level || 'info').toUpperCase();
  const safeScope = String(scope || 'main');
  const base = `[${new Date().toISOString()}] [${safeLevel}] [${safeScope}] ${formatMessage(message)}`;
  const suffix = typeof meta === 'undefined' ? '' : ` ${JSON.stringify(normalizeMeta(meta))}`;
  const line = `${base}${suffix}\n`;

  try {
    fs.appendFileSync(ensureLogFile(), line, 'utf8');
  } catch (error) {
    // Logging must never become the reason the app fails to start.
  }
};

const logger = scope => ({
  debug: (message, meta) => write('debug', scope, message, meta),
  info: (message, meta) => write('info', scope, message, meta),
  warn: (message, meta) => write('warn', scope, message, meta),
  error: (message, meta) => write('error', scope, message, meta)
});

const patchConsole = scope => {
  if (consolePatched) return;
  consolePatched = true;

  for (const level of ['debug', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      write(level, scope || 'main-console', args.map(formatMessage).join(' '));
      original(...args);
    };
  }
};

const setupProcessLogging = () => {
  process.on('uncaughtException', error => {
    write('error', 'main-process', 'Uncaught exception', error);
  });
  process.on('unhandledRejection', reason => {
    write('error', 'main-process', 'Unhandled rejection', serializeError(reason));
  });
};

const setupIPC = () => {
  ipcMain.on('logs:renderer', (event, entry) => {
    if (!entry || typeof entry !== 'object') return;
    const message = String(entry.message || '').slice(0, MAX_RENDERER_MESSAGE_LENGTH);
    write(entry.level || 'info', entry.scope || 'renderer', message, {
      url: event.sender && !event.sender.isDestroyed() ? event.sender.getURL() : '',
      line: entry.line,
      column: entry.column,
      stack: entry.stack
    });
  });

  ipcMain.handle('logs:get-info', () => ({
    directory: getLogDirectory(),
    file: getLogFile()
  }));

  ipcMain.handle('logs:open-directory', () => {
    shell.showItemInFolder(getLogFile());
  });
};

/**
 * 渲染层的已知无害噪音，不写进日志，以免把真正有用的信息挤下去。
 *
 * 目前只有一条：某处第三方代码把非 JSON 字符串交给 JSON.parse，失败后自己
 * console.error 出来。它从 2026-07 起每次启动都出现（历史日志累计 284 次），
 * 而解析失败本身已被业务代码用 try/catch 忽略（见 gui.html 与 scratch-gui 的
 * themePersistance.js），功能上没有任何影响。根因位于 node_modules 里的第三方
 * 代码，无法直接修；该字符串也不来自 localStorage（已核查），清数据也无效。
 *
 * 过滤条件故意收得很窄：必须同时是 SyntaxError 且明确是 JSON 解析失败，
 * 以免掩盖真正的语法错误。
 */
const isIgnoredRendererNoise = message =>
  message.startsWith('SyntaxError') && message.includes('is not valid JSON');

const attachWebContentsLogging = (webContents, scope) => {
  if (!webContents || webContents.isDestroyed()) return;

  webContents.on('console-message', event => {
    const message = event.message || '';
    if (isIgnoredRendererNoise(message)) return;
    const level = event.level === 'error' && message.startsWith('Warning:') ? 'warning' : event.level;
    write(`renderer-${level || 'log'}`, scope, message, {
      line: event.lineNumber,
      source: event.sourceId
    });
  });

  webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    write('error', scope, 'Window failed to load', {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame
    });
  });

  webContents.on('render-process-gone', (event, details) => {
    write('error', scope, 'Renderer process gone', details);
  });

  webContents.on('unresponsive', () => {
    write('warn', scope, 'Window became unresponsive');
  });

  webContents.on('responsive', () => {
    write('info', scope, 'Window became responsive');
  });
};

const initialize = () => {
  if (initialized) return;
  initialized = true;
  patchConsole('main-console');
  setupProcessLogging();
  setupIPC();
  write('info', 'main', 'Logging initialized', {
    logFile: getLogFile(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  });
};

module.exports = {
  initialize,
  patchConsole,
  logger,
  write,
  attachWebContentsLogging,
  getLogDirectory,
  getLogFile
};
