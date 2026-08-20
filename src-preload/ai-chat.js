const {contextBridge, ipcRenderer} = require('electron');

const installRendererLogging = scope => {
  const serializeReason = reason => {
    if (reason instanceof Error) return {message: reason.message, stack: reason.stack};
    if (reason && typeof reason === 'object') return {message: reason.message || JSON.stringify(reason), stack: reason.stack};
    return {message: String(reason)};
  };
  const send = entry => {
    try {
      ipcRenderer.send('logs:renderer', entry);
    } catch (error) {
      // Logging must not interfere with renderer startup.
    }
  };
  window.addEventListener('error', event => {
    send({
      level: 'error',
      scope,
      message: event.message,
      line: event.lineno,
      column: event.colno,
      stack: event.error && event.error.stack
    });
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = serializeReason(event.reason);
    send({
      level: 'error',
      scope,
      message: `Unhandled promise rejection: ${reason.message}`,
      stack: reason.stack
    });
  });
};

installRendererLogging('ai-chat-preload');

contextBridge.exposeInMainWorld('AIChatPreload', {
  getLogInfo: () => ipcRenderer.invoke('logs:get-info'),
  openLogDirectory: () => ipcRenderer.invoke('logs:open-directory'),
  getState: () => ipcRenderer.invoke('ai:get-state'),
  saveConfig: input => ipcRenderer.invoke('ai:save-config', input),
  fetchModels: () => ipcRenderer.invoke('ai:fetch-models'),
  continueLastSession: () => ipcRenderer.invoke('ai:continue-last-session'),
  startNewSession: () => ipcRenderer.invoke('ai:start-new-session'),
  uploadContext: selection => ipcRenderer.invoke('ai:upload-context', selection),
  sendMessage: (text, selection) => ipcRenderer.invoke('ai:send-message', text, selection),
  recognizeSpeech: () => ipcRenderer.invoke('ai:recognize-speech'),
  freeCheckLogin: () => ipcRenderer.invoke('ai:free-check-login'),
  freeLogin: () => ipcRenderer.invoke('ai:free-login'),
  freeClose: () => ipcRenderer.invoke('ai:free-close'),
  onState: callback => {
    const listener = (event, state) => callback(state);
    ipcRenderer.on('ai:state', listener);
    return () => ipcRenderer.removeListener('ai:state', listener);
  }
});
