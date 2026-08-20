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

installRendererLogging('editor-preload');

contextBridge.exposeInMainWorld('EditorPreload', {
  isInitiallyFullscreen: () => ipcRenderer.sendSync('is-initially-fullscreen'),
  getInitialFile: () => ipcRenderer.invoke('get-initial-file'),
  getFile: (id) => ipcRenderer.invoke('get-file', id),
  openedFile: (id) => ipcRenderer.invoke('opened-file', id),
  closedFile: () => ipcRenderer.invoke('closed-file'),
  showSaveFilePicker: (suggestedName, format) => ipcRenderer.invoke('show-save-file-picker', suggestedName, format),
  convertToHwp: (sb3Data) => ipcRenderer.invoke('convert-to-hwp', sb3Data),
  showOpenFilePicker: () => ipcRenderer.invoke('show-open-file-picker'),
  setLocale: (locale) => ipcRenderer.sendSync('set-locale', locale),
  setChanged: (changed) => ipcRenderer.invoke('set-changed', changed),
  openNewWindow: () => ipcRenderer.invoke('open-new-window'),
  openAddonSettings: (search) => ipcRenderer.invoke('open-addon-settings', search),
  openPackager: () => ipcRenderer.invoke('open-packager'),
  openAIChat: () => ipcRenderer.invoke('open-ai-chat'),
  setRestrictedProjectMode: (mode) => ipcRenderer.invoke('set-restricted-project-mode', mode),
  getLogInfo: () => ipcRenderer.invoke('logs:get-info'),
  openLogDirectory: () => ipcRenderer.invoke('logs:open-directory'),
  ai: {
    getState: () => ipcRenderer.invoke('ai:get-state'),
    saveConfig: input => ipcRenderer.invoke('ai:save-config', input),
    fetchModels: () => ipcRenderer.invoke('ai:fetch-models'),
    continueLastSession: () => ipcRenderer.invoke('ai:continue-last-session'),
    startNewSession: () => ipcRenderer.invoke('ai:start-new-session'),
    setContextCatalog: catalog => ipcRenderer.invoke('ai:set-context-catalog', catalog),
    uploadContext: selection => ipcRenderer.invoke('ai:upload-context', selection),
    sendMessage: (text, selection) => ipcRenderer.invoke('ai:send-message', text, selection),
    recognizeSpeech: () => ipcRenderer.invoke('ai:recognize-speech'),
    freeCheckLogin: () => ipcRenderer.invoke('ai:free-check-login'),
    freeLogin: () => ipcRenderer.invoke('ai:free-login'),
    freeClose: () => ipcRenderer.invoke('ai:free-close'),
    respond: response => ipcRenderer.send('ai:editor-response', response),
    onState: callback => {
      const listener = (event, state) => callback(state);
      ipcRenderer.on('ai:state', listener);
      return () => ipcRenderer.removeListener('ai:state', listener);
    },
    onContextRequest: callback => {
      const listener = (event, request) => callback(request);
      ipcRenderer.on('ai:request-context', listener);
      return () => ipcRenderer.removeListener('ai:request-context', listener);
    },
    onApplyOperations: callback => {
      const listener = (event, request) => callback(request);
      ipcRenderer.on('ai:apply-operations', listener);
      return () => ipcRenderer.removeListener('ai:apply-operations', listener);
    }
  },
  openDesktopSettings: () => ipcRenderer.invoke('open-desktop-settings'),
  openPrivacy: () => ipcRenderer.invoke('open-privacy'),
  openAbout: () => ipcRenderer.invoke('open-about'),
  getPreferredMediaDevices: () => ipcRenderer.invoke('get-preferred-media-devices'),
  getAdvancedCustomizations: () => ipcRenderer.invoke('get-advanced-customizations'),
  setExportForPackager: (callback) => {
    exportForPackager = callback;
  },
  setIsFullScreen: (isFullScreen) => ipcRenderer.invoke('set-is-full-screen', isFullScreen)
});

let exportForPackager = () => Promise.reject(new Error('exportForPackager missing'));

ipcRenderer.on('export-project-to-port', (e) => {
  const port = e.ports[0];
  exportForPackager()
    .then(({data, name}) => {
      port.postMessage({ data, name });
    })
    .catch((error) => {
      console.error(error);
      port.postMessage({ error: true });
    });
});

window.addEventListener('message', (e) => {
  if (e.source === window) {
    const data = e.data;
    if (data && typeof data.ipcStartWriteStream === 'string') {
      ipcRenderer.postMessage('start-write-stream', data.ipcStartWriteStream, e.ports);
    }
  }
});

ipcRenderer.on('enumerate-media-devices', (e) => {
  navigator.mediaDevices.enumerateDevices()
    .then((devices) => {
      e.sender.send('enumerated-media-devices', {
        devices: devices.map((device) => ({
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label
        }))
      });
    })
    .catch((error) => {
      console.error(error);
      e.sender.send('enumerated-media-devices', {
        error: `${error}`
      });
    });
});

contextBridge.exposeInMainWorld('PromptsPreload', {
  alert: (message) => ipcRenderer.sendSync('alert', message),
  confirm: (message) => ipcRenderer.sendSync('confirm', message),
});

// In some Linux environments, people may try to drag & drop files that we don't have access to.
// Remove when https://github.com/electron/electron/issues/30650 is fixed.
if (navigator.userAgent.includes('Linux')) {
  document.addEventListener('drop', (e) => {
    if (e.isTrusted) {
      for (const file of e.dataTransfer.files) {
        // Using webUtils is safe as we don't have a legacy build for Linux
        const {webUtils} = require('electron');
        const path = webUtils.getPathForFile(file);
        ipcRenderer.invoke('check-drag-and-drop-path', path);
      }
    }
  }, {
    capture: true
  });
}
