/**
 * 02Engine / hidream 扩展的「扩展开面板」条目定义。
 *
 * 用法二选一：
 *   1) 直接把这 6 个对象追加到 scratch-gui 的
 *      src/lib/libraries/extensions/index.jsx 的数组里（图标 import 路径按落位调整）；
 *   2) 或者作为独立文件 import 进去再 concat。
 *
 * 关键约束：extensionURL 必须与
 *   scratch-vm/src/extension-support/tw-default-extension-urls.js
 * 里的映射逐字一致，否则同一个扩展会被当成两个不同 id 加载两遍。
 *
 * 图标：本目录 icons/ 下有 6 张 png（从 02Engine 移植时一并带过来的）。
 */

import hidreamLiquidGlassPopupIconURL from './icons/liquid-glass-popup.png';
import hidreamLiquidGlassV4IconURL from './icons/liquid-glass-render-v4.png';
import hidreamImageProcessingIconURL from './icons/image-processing.png';
import hidreamCyberexplorerIconURL from './icons/cyberexplorer-toolbox-mini.png';
import hidreamNeteaseMusicIconURL from './icons/netease-music.png';
import hidreamFilePlusIconURL from './icons/file-plus.png';

const hidreamExtensions = [
    {
        name: '液态玻璃弹窗',
        extensionId: 'liquidGlassPopup',
        extensionURL: 'tw-extensions://./hidream_puw.js',
        iconURL: hidreamLiquidGlassPopupIconURL,
        description: '液态玻璃风格的提示 / 确认 / 输入弹窗，可作为积木输出结果。',
        tags: ['tw']
    },
    {
        name: '液态玻璃 V4',
        extensionId: 'webglLiquidGlassV4',
        extensionURL: 'tw-extensions://./liquid-glass-render-v4.js',
        iconURL: hidreamLiquidGlassV4IconURL,
        description: '基于 WebGL 的液态玻璃渲染效果。',
        tags: ['tw']
    },
    {
        name: '图像处理',
        extensionId: 'ImageProcessor',
        extensionURL: 'tw-extensions://./image-processing.js',
        iconURL: hidreamImageProcessingIconURL,
        description: '读取图片尺寸、取色、裁剪等图像处理积木。',
        tags: ['tw']
    },
    {
        name: 'Cyberexplorer',
        extensionId: 'cyberexplorertoolboxmini',
        extensionURL: 'tw-extensions://./cyberexplorer-toolbox-mini.js',
        iconURL: hidreamCyberexplorerIconURL,
        description: 'Cyberexplorer 工具箱（精简版）。',
        tags: ['tw']
    },
    {
        name: '网易云音乐',
        extensionId: 'NTeaseMusic',
        extensionURL: 'tw-extensions://./netease-music.js',
        iconURL: hidreamNeteaseMusicIconURL,
        description: '搜索并播放网易云音乐。',
        tags: ['tw']
    },
    {
        name: 'Hidream File',
        extensionId: 'filehelperprov2',
        extensionURL: 'tw-extensions://./file-plus.js',
        iconURL: hidreamFilePlusIconURL,
        description: '打开单个/多个本地文件并读取内容。',
        tags: ['tw']
    }
];

export default hidreamExtensions;
