// 临时探针：确认 electron 以「脚本路径」启动时 process.defaultApp 的值
// Windows 上 Electron 主进程的 stdout 不接控制台，所以写文件。
const fs = require('fs');
const path = require('path');
const electron = require('electron');
const out = path.join(__dirname, 'tmp-argv-probe.out.json');
fs.writeFileSync(out, JSON.stringify({
  defaultApp: process.defaultApp,
  argv: process.argv,
  isPackaged: electron.app.isPackaged
}, null, 2));
electron.app.exit(0);
