const AbstractWindow = require('./abstract');
const {APP_NAME} = require('../brand');

class AIChatWindow extends AbstractWindow {
  constructor (editorWindow) {
    super();
    this.editorWindow = editorWindow;
    editorWindow.aiService.registerView(this.window.webContents);
    editorWindow.aiService.attachIPC(this.ipc);

    this.window.setTitle(`AI 助手 - ${APP_NAME}`);
    this.window.on('page-title-updated', event => event.preventDefault());
    this.loadURL('tw-ai-chat://./index.html');
    this.show();
  }

  getPreload () {
    return 'ai-chat';
  }

  getDimensions () {
    return {width: 480, height: 640};
  }

  getBackgroundColor () {
    return '#18222f';
  }

  static forEditor (editorWindow) {
    const existing = AbstractWindow.getWindowsByClass(AIChatWindow)
      .find(window => window.editorWindow === editorWindow);
    if (existing) {
      existing.show();
      return;
    }
    new AIChatWindow(editorWindow);
  }
}

module.exports = AIChatWindow;
