/**
 * HiWarp: 角色库的 Material Symbols 支持。
 *
 * 数据来源：dist-library-files/material-symbols/（由 scripts/prepare-material-symbols.mjs
 * 从 @material-symbols/svg-400 生成），通过 tw-library:// 协议按文件读取。
 *
 * 为什么不走常规的 assetId/md5ext 路径：
 *   上游 library-item.jsx 把缩略图写死成 https://cdn.assets.scratch.mit.edu/...，
 *   我们的图标不在 Scratch 素材服务器上。所以条目只提供 rawURL（本地协议），
 *   插入时再把 SVG 变成真实 asset 交给 VM（deserialize-assets.js 支持内联 asset）。
 */
const LIBRARY_BASE = 'tw-library://./material-symbols';

/** 三个风格的标签定义，tag 会成为角色库顶部的一个筛选按钮 */
// 标签文案刻意用短名：三个全名（"Material Symbols 轮廓" 等）会把标签栏挤到
// 折行后被裁掉，或被迫出现横向滚动条。来源与许可证见 docs/TECHNICAL.md §3.11。
export const MATERIAL_SYMBOL_STYLES = [
    {style: 'outlined', tag: 'material-symbols-outlined', label: '轮廓'},
    {style: 'rounded', tag: 'material-symbols-rounded', label: '圆角'},
    {style: 'sharp', tag: 'material-symbols-sharp', label: '尖锐'}
];

/** 实心变体是同一目录下的 `<name>-fill.svg` */
export const MATERIAL_SYMBOL_FILL_SUFFIX = '-fill';

/**
 * 插入时的舞台尺寸。Material Symbols 原始 viewBox 是 24×24，
 * 直接作为造型只有 24 个舞台单位，几乎看不见，所以统一放大。
 */
export const MATERIAL_SYMBOL_STAGE_SIZE = 100;

let indexPromise = null;

/**
 * 读取图标清单（只请求一次，之后复用）。
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
                // 失败时清掉缓存，下次打开库还能重试
                indexPromise = null;
                throw error;
            });
    }
    return indexPromise;
};

const buildIconFile = (name, fill) => `${name}${fill ? MATERIAL_SYMBOL_FILL_SUFFIX : ''}.svg`;

/**
 * 把清单摊平成角色库条目。
 * @param {{icons: Record<string, string[]>}} index
 * @param {boolean} fill 是否使用实心变体
 */
export const buildMaterialSymbolItems = (index, fill) => {
    const items = [];
    for (const {style, tag} of MATERIAL_SYMBOL_STYLES) {
        const names = (index.icons && index.icons[style]) || [];
        for (const name of names) {
            items.push({
                name,
                key: `material-symbols/${style}/${buildIconFile(name, fill)}`,
                tags: [tag],
                // 图标有三千多个，混进「所有」会把常规角色挤出视野
                hiddenInAllTag: true,
                rawURL: `${LIBRARY_BASE}/${style}/${buildIconFile(name, fill)}`,
                hiwarpIcon: {style, name}
            });
        }
    }
    return items;
};

/**
 * 把 SVG 的显示尺寸统一成目标尺寸（viewBox 保持不变，内容自动缩放）。
 * @param {string} text SVG 源码
 * @param {number} size 目标边长
 */
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
 * 取一个图标的 SVG 源码。
 * @param {{rawURL: string}} item 角色库条目
 */
export const fetchMaterialSymbolSvg = item => fetch(item.rawURL)
    .then(response => {
        if (!response.ok) {
            throw new Error(`图标读取失败: HTTP ${response.status}`);
        }
        return response.text();
    });

// 已创建但还没落盘的图标资源：assetId -> asset。
// 原因见 insertMaterialSymbol 里的注释：sb3 反序列化不会带走内联 asset，
// 造型最终会走 storage.load(assetId)，所以必须让 storage 自己能找到它。
const iconAssets = new Map();
const registeredStorages = new WeakSet();

/**
 * 给 storage 注册一个高优先级 helper：命中内存里的图标资源就返回，
 * 未命中返回 null 让 scratch-storage 继续试下一个 helper。
 * @param {object} storage scratch-storage 实例
 */
export const ensureIconAssetHelper = storage => {
    if (registeredStorages.has(storage)) return;
    registeredStorages.add(storage);
    storage.addHelper({
        // 注意：没命中时必须「同步返回 null」。scratch-storage 用
        // `if (loading === null) return tryNextHelper();` 判断"换下一个 helper"，
        // 返回 Promise.resolve(null) 会被当成"找到了，值是 null"，
        // 于是所有非图标资源都拿不到 → 全部造型变成坏造型（舞台上显示 ?）。
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

/**
 * 把图标作为新角色插入项目。
 * @param {object} vm scratch-vm 实例
 * @param {{name: string, rawURL: string}} item 角色库条目
 */
export const insertMaterialSymbol = async (vm, item) => {
    const storage = vm && vm.runtime && vm.runtime.storage;
    if (!storage) {
        throw new Error('当前 VM 没有素材存储，无法插入图标');
    }

    const svg = resizeSvg(await fetchMaterialSymbolSvg(item), MATERIAL_SYMBOL_STAGE_SIZE);
    // 必须是字节而不是字符串：scratch-render 的矢量图路径用 TextDecoder.decode()
    // 处理素材，收到字符串会抛 "parameter 1 is not of type 'ArrayBuffer'"，
    // 造型随即变成坏造型（舞台上显示 ?）。
    const bytes = new TextEncoder().encode(svg);
    const asset = storage.createAsset(storage.AssetType.ImageVector, 'svg', bytes, null, true);
    // 先登记，等 sb3 反序列化走到 storage.load 时就能拿到（见 ensureIconAssetHelper）
    registerIconAsset(storage, asset);

    const half = MATERIAL_SYMBOL_STAGE_SIZE / 2;
    const md5ext = `${asset.assetId}.svg`;

    const sprite = {
        isStage: false,
        name: item.name,
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [{
            name: item.name,
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
