/**
 * 为从 02Engine(desktop) 搬运的文件添加版权声明头。
 * 用法: node SpeedScript/add-copyright.js
 * 说明: 修改/重装 node_modules 后需重新运行, 以恢复版权头。
 *       JS/JSX 使用 /*! 注释, webpack production(terser) 构建时会保留。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NOTICE = '版权声明：来自 https://github.com/02engine/desktop.git';
const PARTIAL_NOTICE = '版权声明：部分代码来自 https://github.com/02engine/desktop.git';

// 完整搬运自 02Engine(desktop) 的文件
const FULL_FILES = [
  'node_modules/scratch-gui/src/containers/extension-library.jsx',
  'node_modules/scratch-gui/src/components/library/library.jsx',
  'node_modules/scratch-gui/src/components/library/library.css',
  'node_modules/scratch-gui/src/containers/tw-ccw-extension-modal.jsx',
  'node_modules/scratch-gui/src/components/tw-ccw-extension-modal/ccw-extension-modal.jsx',
  'node_modules/scratch-gui/src/components/tw-ccw-extension-modal/ccw-extension-modal.css',
  'node_modules/scratch-gui/src/containers/tw-extension-import-modal.jsx',
  'node_modules/scratch-gui/src/components/tw-extension-import-modal/extension-import-modal.jsx',
  'node_modules/scratch-gui/src/components/tw-extension-import-modal/extension-import-modal.css',
  'node_modules/scratch-gui/static/extensions/ExtFind.js',
  'node_modules/scratch-gui/static/extensions/ExtFind.svg',
  'node_modules/scratch-gui/static/penguinmod/extensions.js',
  'node_modules/scratch-gui/src/lib/libraries/extensions/custom/ccw.svg'
];

// 部分使用了 02Engine 代码的文件
const PARTIAL_FILES = [
  'node_modules/scratch-gui/src/lib/libraries/extensions/index.jsx',
  'node_modules/scratch-gui/src/lib/libraries/tw-extension-tags.js'
];

const commentFor = (file, notice) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.css') return `/*! ${notice} */\n\n`;
  if (ext === '.svg') return `<!-- ${notice} -->\n\n`;
  return `/*! ${notice} */\n\n`;
};

const addNotice = (rel, notice) => {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.log(`[跳过] 不存在: ${rel}`);
    return;
  }
  let original = fs.readFileSync(abs, 'utf8');
  // 移除旧的任何格式版权声明行（包含 02engine/desktop.git 的注释行）, 避免重复
  const stripped = original
    .replace(/^(?:\/\/|\/\*!?|<!--)[^\r\n]*02engine[^\r\n]*(?:\*\/|-->)?\s*(?:\r?\n)+/, '');
  const updated = commentFor(rel, notice) + stripped;
  if (original === updated) {
    console.log(`[已存在] ${rel}`);
    return;
  }
  fs.writeFileSync(abs, updated, 'utf8');
  console.log(`[已添加] ${rel}`);
};

for (const file of FULL_FILES) addNotice(file, NOTICE);
for (const file of PARTIAL_FILES) addNotice(file, PARTIAL_NOTICE);

console.log('完成');
