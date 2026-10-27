/**
 * HiWarp: 加载项（Addons）的「默认启用」表。
 *
 * ── 为什么需要它 ────────────────────────────────────────────────
 * 上游把启用状态完全交给 localStorage['tw:addons']；其中 enabledByDefault
 * 为 true 的只有 21 个，其余（含本表里的大部分）默认关闭。这份存储一旦被清空
 * （重装、换构建、清缓存、重置加载项），用户手工打开的插件就全部回到关闭状态。
 *
 * 这里在加载项系统初始化之前，把「存储里没有明确写过 enabled 的加载项」按
 * 本表补成 true。
 *
 * ── 语义（有意如此，别改成强制覆盖）──────────────────────────────
 * 只在缺失时补齐，已有值一律不动 ⇒ 用户手动关闭后仍然保持关闭。
 * 所以它是「默认值」，不是「强制值」。旧实现在 settings-store.js 里硬编码
 * 白名单并无条件覆盖，导致用户关不掉、且 npm ci 后补丁丢失就彻底失效。
 *
 * ── 维护方式 ────────────────────────────────────────────────────
 * 改下面的数组即可，改完执行 npm run webpack:compile 重新编译渲染层。
 * 加载项 id 就是 node_modules/scratch-gui/src/addons/addons/ 下的目录名。
 * 本文件在我们自己的源码树里，不受 npm ci 影响，不要挪进 patches/。
 */

// 必须与 scratch-gui/src/addons/settings-store.js 的 SETTINGS_KEY 一致。
const STORAGE_KEY = 'tw:addons';
// 必须与同文件的 VERSION 一致；仅在存储整体缺失时用它写版本号。
const STORAGE_VERSION = 5;

export const DEFAULT_ENABLED_ADDONS = [
  // 最新
  'expanded-backpack',
  // 界面 / 外观
  'cat-blocks',
  'block-palette-icons',
  'block-count',
  'editor-colored-context-menus',
  'custom-block-shape',
  'editor-square-inputs',
  'zebra-striping',
  'custom-menu-bar',
  'editor-theme3',
  'custom-block-text',
  'transparent-orphans',
  'remove-curved-stage-border',
  'custom-zoom',
  'hide-stage',
  // 积木操作
  'editor-devtools',
  'find-bar',
  'middle-click-popup',
  'jump-to-def',
  'reorder-custom-inputs',
  'editor-searchable-dropdowns',
  'block-switching',
  'copy-reporter',
  'blocks2image',
  'block-cherry-picking',
  'block-duplicate',
  'disable-paste-offset',
  'swap-local-global',
  'rename-broadcasts',
  'editor-comment-previews',
  'script-snap',
  'editor-extra-keys',
  'no-script-bumping',
  'editor-number-arrow-keys',
  'number-pad',
  // 变量 / 数据
  'data-category-tweaks-v2',
  'variable-manager',
  'hide-flyout',
  // 舞台 / 播放
  'pause',
  'mute-project',
  'vol-slider',
  'fullscreen',
  'clones',
  'mouse-pos',
  'color-picker',
  'pick-colors-from-stage',
  'gamepad',
  // 角色 / 造型
  'folders',
  'search-sprites',
  'initialise-sprite-position',
  'move-to-top-layer',
  'paint-by-default',
  'onion-skinning',
  'paint-snap',
  'paint-skew',
  'default-costume-editor-color',
  'bitmap-copy',
  '2d-color-picker',
  'better-img-uploads',
  // 工具 / 其他
  'debugger',
  'mediarecorder',
  'drag-drop',
  'editor-sounds',
  'load-extensions',
  'remove-sprite-confirm'
];

/**
 * 每个插件内部的参数默认值（只补缺失，不覆盖已有值）。
 *
 * 数据来源：2026-10-27 逐张核对了「加载项设置」页的实际取值与上游
 * `_manifest_entry.js` 里的 default，40 个带参数的插件里唯一不同的是
 * custom-block-shape（圆角拉满 300、不要缺口 0），与旧构建的存储备份一致。
 * 其余插件全部等于上游默认，因此不在这里重复声明。
 */
export const DEFAULT_ADDON_SETTINGS = {
  'custom-block-shape': {
    cornerSize: 300,
    notchSize: 0
  }
};

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * 纯函数：把默认值种进一份存储快照。不读不写全局，便于测试。
 *
 * @param {string|null} raw 与 localStorage['tw:addons'] 同构的原始字符串
 * @param {{ids?: string[], settings?: object, version?: number}} [options]
 * @returns {{store: object, changed: boolean}}
 */
export const seedAddonDefaults = (raw, options) => {
  const {
    ids = DEFAULT_ENABLED_ADDONS,
    settings = DEFAULT_ADDON_SETTINGS,
    version = STORAGE_VERSION
  } = options || {};

  let store;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    store = isPlainObject(parsed) ? parsed : {};
  } catch (e) {
    // 存储内容损坏：当作空表处理，让它被默认值重建，而不是抛异常拖崩编辑器
    store = {};
  }

  let changed = false;

  // 存储整体缺失时补版本号，避免上游下次迁移把这份表当成旧版本再迁一遍
  if (!Object.prototype.hasOwnProperty.call(store, '_')) {
    store._ = version;
    changed = true;
  }

  for (const id of ids) {
    if (!isPlainObject(store[id])) {
      store[id] = {};
    }
    // 只认布尔值：null / 字符串 / 数字都是坏数据，按缺失处理，否则上游
    // getAddonEnabled 会把它当"已设置"而返回假值，插件就永远开不起来。
    if (typeof store[id].enabled !== 'boolean') {
      store[id].enabled = true;
      changed = true;
    }
  }

  // 插件内部参数：同样只补缺失，用户调整过的值一律不动。
  for (const [addonId, defaults] of Object.entries(settings)) {
    if (!isPlainObject(store[addonId])) {
      store[addonId] = {};
    }
    for (const [key, value] of Object.entries(defaults)) {
      if (!Object.prototype.hasOwnProperty.call(store[addonId], key)) {
        store[addonId][key] = value;
        changed = true;
      }
    }
  }

  return {store, changed};
};

/**
 * 把默认值写回 localStorage。返回是否真的写了。
 * localStorage 不可用时静默返回 false —— 存储坏了也不能让编辑器起不来。
 */
export const applyAddonDefaults = () => {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    const {store, changed} = seedAddonDefaults(localStorage.getItem(STORAGE_KEY));
    if (!changed) {
      return false;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    return false;
  }
};

// 模块被引入即生效：调用方只需保证它是第一个 import。
applyAddonDefaults();
