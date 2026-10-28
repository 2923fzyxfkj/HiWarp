/**
 * HiWarp: 角色库的 Material Symbols 支持。
 *
 * 数据来源：dist-library-files/material-symbols/
 *   - index.json    图标名清单（每个风格一份基础名）
 *   - <style>.json  图标归档 { "<name>": "<svg>", "<name>-fill": "<svg>" }
 *   由 scripts/prepare-material-symbols.mjs 从 @material-symbols/svg-400 生成。
 *
 * 为什么是归档而不是每个图标一个文件：
 *   23,622 个散文件会让 electron-builder 每次封装、WSL 每次 rsync 都退化成
 *   inode 操作。归档后只有 5 个文件，构建时间与图标数量脱钩。
 *
 * 为什么缩略图用 data URL：
 *   上游 library-item.jsx 把缩略图写死成 Scratch CDN 的 md5 路径，我们的图标
 *   不在那儿。条目只提供 rawURL（这里是 data URL），iconMd5 留空即可。
 */
const LIBRARY_BASE = 'tw-library://./material-symbols';

/** 三个风格的标签定义，tag 会成为角色库顶部的一个筛选按钮 */
// 标签文案刻意用短名：三个全名会把标签栏挤到折行后被裁掉。
export const MATERIAL_SYMBOL_STYLES = [
    {style: 'outlined', tag: 'material-symbols-outlined', label: '轮廓'},
    {style: 'rounded', tag: 'material-symbols-rounded', label: '圆角'},
    {style: 'sharp', tag: 'material-symbols-sharp', label: '尖锐'}
];

/** 实心变体在归档里的键后缀 */
export const MATERIAL_SYMBOL_FILL_SUFFIX = '-fill';

/**
 * 插入时的舞台尺寸。Material Symbols 原始 viewBox 是 960×960（原点在负 Y），
 * 直接作为造型会落在框外，这里统一归一化并放大。
 */
export const MATERIAL_SYMBOL_STAGE_SIZE = 100;

/** 归档还没加载完时用的透明占位图，避免 <img> 出现裂图 */
const TRANSPARENT_ICON = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 960 960%22/%3E';

/** style -> { name: svg } */
const styleArchives = new Map();
/** style -> Promise（避免重复请求） */
const stylePromises = new Map();

let indexPromise = null;

/**
 * 读取图标名清单（只请求一次）。
 * @returns {Promise<{styles: string[], icons: Record<string, string[]>, counts: object}>}
 */
export const loadMaterialSymbolsIndex = () => {
    if (!indexPromise) {
        indexPromise = fetch(`${LIBRARY_BASE}/index.json`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Material Symbols 清单读取失败: HTTP ${response.status}`);
                }
                return response.json();
            })
            .catch(error => {
                indexPromise = null;
                throw error;
            });
    }
    return indexPromise;
};

/**
 * 读取某个风格的图标归档（约 4~6 MB，只请求一次）。
 * @param {string} style outlined / rounded / sharp
 * @returns {Promise<Record<string, string>>}
 */
export const loadMaterialSymbolsStyle = style => {
    if (styleArchives.has(style)) {
        return Promise.resolve(styleArchives.get(style));
    }
    if (stylePromises.has(style)) {
        return stylePromises.get(style);
    }
    const promise = fetch(`${LIBRARY_BASE}/${style}.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Material Symbols 图标归档读取失败（${style}）: HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(archive => {
            styleArchives.set(style, archive);
            stylePromises.delete(style);
            return archive;
        })
        .catch(error => {
            stylePromises.delete(style);
            throw error;
        });
    stylePromises.set(style, promise);
    return promise;
};

/** 该风格的归档是否已就绪（用于决定要不要重建条目） */
export const isMaterialSymbolsStyleLoaded = style => styleArchives.has(style);

/** 归档里的键：实心是 <name>-fill */
const archiveKey = (name, fill) => `${name}${fill ? MATERIAL_SYMBOL_FILL_SUFFIX : ''}`;

/**
 * 取某个图标的 SVG 源码；归档未加载时返回 null。
 * @returns {string|null}
 */
export const getMaterialSymbolSvg = (style, name, fill) => {
    const archive = styleArchives.get(style);
    if (!archive) return null;
    const svg = archive[archiveKey(name, fill)];
    return typeof svg === 'string' ? svg : null;
};

/** SVG 源码 -> 可直接放进 <img src> 的 data URL */
export const svgToDataUrl = svg => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * 把清单摊平成角色库条目。
 *
 * rawURL 是**惰性 getter**：归档没加载完时返回透明占位图，加载完成后重建条目
 * 即可显示真实缩略图。这样打开面板时不需要一次性解析十几 MB。
 *
 * @param {{icons: Record<string, string[]>}} index
 * @param {boolean} fill 是否使用实心变体
 */
export const buildMaterialSymbolItems = (index, fill) => {
    const items = [];
    for (const {style, tag} of MATERIAL_SYMBOL_STYLES) {
        const names = (index.icons && index.icons[style]) || [];
        for (const name of names) {
            const item = {
                name,
                key: `material-symbols/${style}/${archiveKey(name, fill)}`,
                tags: [tag],
                // 图标有三千多个，混进「所有」会把常规角色挤出视野
                hiddenInAllTag: true,
                hiwarpIcon: {style, name, fill}
            };
            Object.defineProperty(item, 'rawURL', {
                enumerable: true,
                get () {
                    const svg = getMaterialSymbolSvg(style, name, fill);
                    return svg ? svgToDataUrl(svg) : TRANSPARENT_ICON;
                }
            });
            items.push(item);
        }
    }
    return items;
};

// 已创建但还没落盘的图标资源：assetId -> asset。
// sb3 反序列化不会带走内联 asset，造型最终会走 storage.load(assetId)，
// 所以必须让 storage 自己能找到它。
const iconAssets = new Map();
const registeredStorages = new WeakSet();

/**
 * 给 storage 注册一个高优先级 helper：命中内存里的图标资源就返回，
 * 未命中**同步返回 null** 让 scratch-storage 继续试下一个 helper。
 * （返回 Promise.resolve(null) 会被当成"找到了一个 null"，导致全站造型损坏。）
 * @param {object} storage scratch-storage 实例
 */
export const ensureIconAssetHelper = storage => {
    if (registeredStorages.has(storage)) return;
    registeredStorages.add(storage);
    storage.addHelper({
        load: (assetType, assetId) => {
            const asset = iconAssets.get(assetId);
            return asset ? Promise.resolve(asset) : null;
        }
    }, 1000);
};

/**
 * 把一个图标资源登记进内存表并确保 storage 已挂上 helper。
 * @param {object} storage scratch-storage 实例
 * @param {object} asset 由 storage.createAsset 返回的资源
 */
export const registerIconAsset = (storage, asset) => {
    iconAssets.set(asset.assetId, asset);
    ensureIconAssetHelper(storage);
    return asset;
};

const resizeSvg = (text, size) => {
    if (typeof text !== 'string' || !text) return text;
    const openTag = text.match(/<svg\b[^>]*>/i);
    if (!openTag) return text;

    // Material Symbols 的 viewBox 是 "0 -960 960 960"，图形画在负 Y 区域。
    // 只改 width/height 不动 viewBox 的话，造型框是 size×size、墨迹却在框外，
    // 表现为「缩略图有图形、舞台上什么都没有」，所以这里把原点归一到 0 0。
    let minX = 0;
    let minY = 0;
    let viewBoxWidth = size;
    let viewBoxHeight = size;
    const viewBox = text.match(/viewBox\s*=\s*"([^"]+)"/i);
    if (viewBox) {
        const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts.every(value => Number.isFinite(value))) {
            [minX, minY, viewBoxWidth, viewBoxHeight] = parts;
        }
    }

    const opening = openTag[0]
        .replace(/\s(width|height)\s*=\s*"[^"]*"/gi, '')
        .replace(/^<svg\b/i, `<svg width="${size}" height="${size}"`)
        .replace(/viewBox\s*=\s*"[^"]*"/i, `viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}"`);

    const bodyStart = text.indexOf(openTag[0]) + openTag[0].length;
    const bodyEnd = text.lastIndexOf('</svg>');
    if (bodyEnd < bodyStart) return text;
    const body = text.slice(bodyStart, bodyEnd);
    const shifted = (minX !== 0 || minY !== 0) ?
        `<g transform="translate(${-minX} ${-minY})">${body}</g>` :
        body;

    return `${opening}${shifted}</svg>`;
};

export {resizeSvg as resizeMaterialSymbolSvg};

/**
 * 把图标作为新角色插入项目。
 * @param {object} vm scratch-vm 实例
 * @param {{hiwarpIcon: {style: string, name: string, fill: boolean}}} item 角色库条目
 */
export const insertMaterialSymbol = async (vm, item) => {
    const storage = vm && vm.runtime && vm.runtime.storage;
    if (!storage) {
        throw new Error('当前 VM 没有素材存储，无法插入图标');
    }

    const {style, name, fill} = item.hiwarpIcon || {};
    let svg = getMaterialSymbolSvg(style, name, fill);
    if (!svg) {
        await loadMaterialSymbolsStyle(style);
        svg = getMaterialSymbolSvg(style, name, fill);
    }
    if (!svg) {
        throw new Error(`找不到图标: ${style}/${archiveKey(name, fill)}`);
    }

    const resized = resizeSvg(svg, MATERIAL_SYMBOL_STAGE_SIZE);
    // 必须是字节而不是字符串：scratch-render 的矢量图路径用 TextDecoder.decode()
    // 处理素材，收到字符串会抛 "parameter 1 is not of type 'ArrayBuffer'"。
    const bytes = new TextEncoder().encode(resized);
    const asset = storage.createAsset(storage.AssetType.ImageVector, 'svg', bytes, null, true);
    registerIconAsset(storage, asset);

    const half = MATERIAL_SYMBOL_STAGE_SIZE / 2;
    const md5ext = `${asset.assetId}.svg`;

    const sprite = {
        isStage: false,
        name,
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [{
            name,
            dataFormat: 'svg',
            assetId: asset.assetId,
            md5ext,
            bitmapResolution: 1,
            rotationCenterX: half,
            rotationCenterY: half
        }],
        sounds: [],
        volume: 100,
        layerOrder: 0,
        visible: true,
        x: 0,
        y: 0,
        size: 100,
        direction: 90,
        draggable: false,
        rotationStyle: 'all around'
    };

    await vm.addSprite(JSON.stringify(sprite));
    return sprite.name;
};
