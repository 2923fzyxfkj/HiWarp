const unsupported = feature => () => {
  const message = `Web build does not support ${feature}. Use HiWarp Desktop for this feature.`;
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(message);
  }
};

const asyncUnsupported = feature => async () => {
  throw new Error(`Web build does not support ${feature}. Use HiWarp Desktop for this feature.`);
};

if (typeof globalThis !== 'undefined' && !globalThis.EditorPreload) {
  const noop = () => {};
  const unsubscribe = () => noop;
  const aiState = {
    messages: [],
    config: {
      apiBaseUrl: '',
      apiKeySaved: false,
      model: '',
      contextMode: 'currentSprite',
      permissions: {
        insertScript: true,
        replaceScript: true,
        deleteScript: false,
        updateVariable: false,
        updateSprite: false
      }
    },
    modelChoices: [],
    contextCatalog: [],
    hasContextSnapshot: false,
    canContinueLastSession: false,
    isStreaming: false,
    error: null
  };

  globalThis.EditorPreload = {
    isWebShim: true,
    isInitiallyFullscreen: () => false,
    getAdvancedCustomizations: async () => ({userscript: '', userstyle: ''}),
    setLocale: () => ({strings: {}}),
    setRestrictedProjectMode: noop,
    setExportForPackager: noop,
    getInitialFile: async () => null,
    getFile: asyncUnsupported('desktop file handles'),
    setChanged: noop,
    openedFile: noop,
    closedFile: noop,
    setIsFullScreen: noop,
    openAddonSettings: search => {
      const url = `../addons/addons.html${typeof search === 'string' && search ? `?q=${encodeURIComponent(search)}` : ''}`;
      window.open(url, '_blank', 'noopener');
    },
    openNewWindow: () => window.open(window.location.href, '_blank', 'noopener'),
    openPackager: () => window.open('https://packager.turbowarp.org/', '_blank', 'noopener'),
    openDesktopSettings: unsupported('desktop settings'),
    openPrivacy: () => window.open('https://desktop.turbowarp.org/privacy.html', '_blank', 'noopener'),
    openAbout: unsupported('about window'),
    openLogDirectory: unsupported('log directory'),
    openAIChat: unsupported('standalone AI window'),
    getPreferredMediaDevices: async () => ({microphone: null, camera: null}),
    convertToHwp: async buffer => buffer,
    showOpenFilePicker: async () => null,
    showSaveFilePicker: async () => null,
    ai: {
      getState: async () => aiState,
      onState: unsubscribe,
      onContextRequest: unsubscribe,
      onApplyOperations: unsubscribe,
      respond: noop,
      setContextCatalog: noop,
      saveConfig: asyncUnsupported('AI configuration'),
      fetchModels: asyncUnsupported('AI model loading'),
      uploadContext: asyncUnsupported('AI context upload'),
      sendMessage: asyncUnsupported('AI assistant'),
      continueLastSession: asyncUnsupported('AI session restore'),
      startNewSession: async () => aiState,
      recognizeSpeech: asyncUnsupported('local speech recognition')
    }
  };
}
