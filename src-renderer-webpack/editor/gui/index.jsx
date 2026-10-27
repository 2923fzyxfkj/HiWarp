// 必须是第一个 import：加载项系统（本文件末尾 require('./addons')）在读取
// localStorage['tw:addons'] 之前，默认启用表就得先种进存储。
import '../addons/hiwarp-addon-defaults.js';
import React from 'react';
import ReactDOM from 'react-dom';
import './web-preload-shim.js';
import GUI from './gui.jsx';

import './media-device-chooser-impl.js';
import '../prompt/prompt.js';

const appTarget = document.getElementById('app');
document.body.classList.add('tw-loaded');
GUI.setAppElement(appTarget);

ReactDOM.render(<GUI />, appTarget);

require('./addons');

EditorPreload.getAdvancedCustomizations().then(({userscript, userstyle}) => {
  if (userstyle) {
    const style = document.createElement('style');
    style.textContent = userstyle;
    document.body.appendChild(style);
  }

  if (userscript) {
    const script = document.createElement('script');
    script.textContent = userscript;
    document.body.appendChild(script);
  }
});
