// It's very important that all error-handling code here be as minimal and
// self contained as possible to ensure that the error handling does not
// itself have errors.

const {app, dialog} = require('electron');
const logging = require('./logging');

const APP_NAME = 'HiWarp Desktop';
const stringifyError = (error) => (error && error.stack) ? error.stack : error;

try {
  logging.patchConsole('main-entrypoint');
  process.on('unhandledRejection', (error) => {
    logging.write('error', 'main-entrypoint', 'Unhandled promise rejection before app startup completed', error);
    console.error('Error in promise:', error);
    app.whenReady().then(() => {
      dialog.showMessageBoxSync({
        type: 'error',
        title: APP_NAME,
        message: `Error in promise: ${stringifyError(error)}`,
        noLink: true
      });
    });
  });

  require('./index');
} catch (error) {
  logging.write('error', 'main-entrypoint', 'Error starting main process', error);
  console.error('Error starting main process:', error);
  app.whenReady().then(() => {
    dialog.showMessageBoxSync({
      type: 'error',
      title: APP_NAME,
      message: `Error starting main process: ${stringifyError(error)}`,
      noLink: true
    });
    app.exit(1);
  });
}
