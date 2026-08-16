const AbstractWindow = require('./abstract');
const {APP_NAME} = require('../brand');

class FeedbackWindow extends AbstractWindow {
  constructor () {
    super();

    this.window.setTitle(`反馈 - ${APP_NAME}`);
    this.window.setMinimizable(false);
    this.window.setMaximizable(false);
    this.loadURL('tw-feedback://./feedback.html');
  }

  getDimensions () {
    return {
      width: 480,
      height: 300
    };
  }

  getBackgroundColor () {
    return '#121826';
  }

  isPopup () {
    return true;
  }

  static show () {
    const window = AbstractWindow.singleton(FeedbackWindow);
    window.show();
  }
}

module.exports = FeedbackWindow;
