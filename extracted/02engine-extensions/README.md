# 02Engine / hidream 扩展包（从 HiWarp Desktop 提取）

这一包是把原本「内置进扩展面板」的 6 个 02Engine/hidream 扩展**摘出来**的独立副本，
不再打进 HiWarp 的内置面板。

## 内容

```
entries.jsx          扩展开面板的条目定义（可直接 import 或粘贴到 index.jsx）
icons/               6 张扩展图标（png，来自 02Engine 移植）
sources/             6 个扩展脚本（从 dist-extensions 导出的构建产物）
```

## 6 个扩展

| 面板名称 | extensionId | 脚本文件 | 说明 |
| --- | --- | --- | --- |
| 液态玻璃弹窗 | `liquidGlassPopup` | `hidream_puw.js` | 液态玻璃风格提示/确认/输入弹窗 |
| 液态玻璃 V4 | `webglLiquidGlassV4` | `liquid-glass-render-v4.js` | WebGL 液态玻璃渲染 |
| 图像处理 | `ImageProcessor` | `image-processing.js` | 图片尺寸/取色/裁剪 |
| Cyberexplorer | `cyberexplorertoolboxmini` | `cyberexplorer-toolbox-mini.js` | 工具箱精简版 |
| 网易云音乐 | `NTeaseMusic` | `netease-music.js` | 搜索并播放 |
| Hidream File | `filehelperprov2` | `file-plus.js` | 读取本地文件 |

## 怎么接回去

### 方案 1：只让项目能加载（不上面板）

不需要条目定义，只要扩展脚本能被 `tw-extensions://` 找到即可：

1. 把 `sources/*.js` 放进仓库的 `dist-extensions/`（生产环境需要再生成 `.br` 版本）
2. 在 `scratch-vm/src/extension-support/tw-default-extension-urls.js` 里保留/添加映射：

```js
liquidGlassPopup: 'tw-extensions://./hidream_puw.js',
ImageProcessor: 'tw-extensions://./image-processing.js',
webglLiquidGlassV4: 'tw-extensions://./liquid-glass-render-v4.js',
cyberexplorertoolboxmini: 'tw-extensions://./cyberexplorer-toolbox-mini.js',
NTeaseMusic: 'tw-extensions://./netease-music.js',
filehelperprov2: 'tw-extensions://./file-plus.js'
```

这样带这些扩展的项目能正常打开，但面板里点不到。

### 方案 2：让面板里能看到（本次撤回的那一版）

把 `entries.jsx` 的内容合并进 `scratch-gui/src/lib/libraries/extensions/index.jsx`：

```js
// 顶部
import hidreamExtensions from '../../../../extracted/02engine-extensions/entries.jsx';

// 数组里（建议放数组开头，"所有"里第一屏就能看到）
export default [
    ...hidreamExtensions,
    // ...原有的内置条目
];
```

图标 import 路径要按你实际的落位调整（`entries.jsx` 里按同目录 `./icons/` 写的）。

**注意**：`extensionURL` 必须与上面那张映射表逐字一致，否则同一个扩展会被当成两个不同 id 加载两遍。

## 许可证

扩展源码来自 `https://github.com/02engine/desktop.git`。仓库里 `SpeedScript/add-copyright.js`
维护的清单会给这些文件加上「版权声明：来自/部分代码来自 02Engine」的注释头，随源码分发时请保留。
