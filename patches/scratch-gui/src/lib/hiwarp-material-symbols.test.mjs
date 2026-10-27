/**
 * hiwarp-material-symbols.js 的单元测试。
 *
 * 用法: node patches/scratch-gui/src/lib/hiwarp-material-symbols.test.mjs
 *
 * 为什么要拷到临时目录：package.json 没有 "type": "module"，node 会把 .js
 * 当 CommonJS 解析，直接 import 会报 "Unexpected token 'export'"。
 * 只测纯逻辑（条目构建 / SVG 尺寸重写），不联网、不碰 VM。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, 'hiwarp-material-symbols.js');
const temp = path.join(os.tmpdir(), `hiwarp-material-symbols-${process.pid}.mjs`);
fs.copyFileSync(source, temp);

const {
    MATERIAL_SYMBOL_STYLES,
    MATERIAL_SYMBOL_FILL_SUFFIX,
    MATERIAL_SYMBOL_STAGE_SIZE,
    buildMaterialSymbolItems,
    registerIconAsset,
    resizeMaterialSymbolSvg
} = await import(pathToFileURL(temp).href);

let pass = 0;
let fail = 0;
const ok = (name, cond) => {
    if (cond) {
        pass++;
        console.log('  OK   ' + name);
    } else {
        fail++;
        console.log('  FAIL ' + name);
    }
};

const fakeIndex = {
    icons: {
        outlined: ['home', 'search'],
        rounded: ['home'],
        sharp: ['home']
    }
};

console.log('=== 1. 风格定义 ===');
{
    ok('三个风格', MATERIAL_SYMBOL_STYLES.length === 3);
    ok('标签名符合 material-symbols-<style>',
        MATERIAL_SYMBOL_STYLES.every(({style, tag}) => tag === `material-symbols-${style}`));
    ok('标签唯一', new Set(MATERIAL_SYMBOL_STYLES.map(s => s.tag)).size === 3);
    ok('每个标签都有文案', MATERIAL_SYMBOL_STYLES.every(s => typeof s.label === 'string' && s.label.length > 0));
    ok('实心后缀是 -fill', MATERIAL_SYMBOL_FILL_SUFFIX === '-fill');
    ok('插入尺寸大于原始 24px', MATERIAL_SYMBOL_STAGE_SIZE > 24);
}

console.log('=== 2. 条目构建（描边） ===');
{
    const items = buildMaterialSymbolItems(fakeIndex, false);
    ok('数量 = 三个风格下的图标总和', items.length === 4);
    const home = items.find(i => i.hiwarpIcon.style === 'outlined' && i.hiwarpIcon.name === 'home');
    ok('rawURL 指向 tw-library 且不带填充后缀',
        home.rawURL === 'tw-library://./material-symbols/outlined/home.svg');
    ok('tags 只有对应风格标签', home.tags.length === 1 && home.tags[0] === 'material-symbols-outlined');
    ok('不会混进「所有」列表', home.hiddenInAllTag === true);
    ok('name 就是图标名（可直接搜索）', home.name === 'home');
    ok('key 唯一', new Set(items.map(i => i.key)).size === items.length);
}

console.log('=== 3. 条目构建（实心） ===');
{
    const items = buildMaterialSymbolItems(fakeIndex, true);
    const home = items.find(i => i.hiwarpIcon.style === 'rounded' && i.hiwarpIcon.name === 'home');
    ok('rawURL 带 -fill 后缀',
        home.rawURL === 'tw-library://./material-symbols/rounded/home-fill.svg');
    ok('key 也区分填充', home.key.indexOf('-fill') !== -1);
}

console.log('=== 4. 清单缺失/异常 ===');
{
    ok('没有 icons 字段时返回空数组', buildMaterialSymbolItems({}, false).length === 0);
    ok('null 不抛异常', (() => {
        try {
            buildMaterialSymbolItems({icons: null}, false);
            return true;
        } catch (e) {
            return false;
        }
    })());
    ok('某个风格缺失只是少一批', buildMaterialSymbolItems({icons: {outlined: ['a']}}, false).length === 1);
}

console.log('=== 5. SVG 尺寸重写与坐标归一 ===');
{
    // Material Symbols 的真实结构：viewBox 原点在负 Y
    const src = '<svg xmlns="http://www.w3.org/2000/svg" height="48" viewBox="0 -960 960 960" width="48"><path d="M1 2"/></svg>';
    const out = resizeMaterialSymbolSvg(src, 100);
    ok('写入目标尺寸', out.indexOf('width="100"') !== -1 && out.indexOf('height="100"') !== -1);
    ok('去掉原有尺寸', out.indexOf('width="48"') === -1 && out.indexOf('height="48"') === -1);
    ok('viewBox 原点归一到 0 0', out.indexOf('viewBox="0 0 960 960"') !== -1);
    ok('内容整体平移回正坐标', out.indexOf('<g transform="translate(0 960)">') !== -1);
    ok('路径内容不变', out.indexOf('<path d="M1 2"/>') !== -1);
    ok('结构闭合正确', out.trim().endsWith('</g></svg>'));

    // 已经是 0 原点的 SVG 不需要平移
    const plain = '<svg width="24" height="24" viewBox="0 0 24 24"><rect width="10" height="10"/></svg>';
    const plainOut = resizeMaterialSymbolSvg(plain, 100);
    ok('0 原点的 SVG 不加平移', plainOut.indexOf('<g transform') === -1);
    ok('内部元素的宽高保留', plainOut.indexOf('<rect width="10" height="10"/>') !== -1);
    ok('开标签被重写', plainOut.indexOf('<svg width="100" height="100"') === 0);

    ok('空字符串安全', resizeMaterialSymbolSvg('', 100) === '');
    ok('非字符串安全', resizeMaterialSymbolSvg(null, 100) === null);
    ok('非 SVG 文本原样返回', resizeMaterialSymbolSvg('not svg', 100) === 'not svg');
}

console.log('=== 6. storage helper：本地图标资源命中 ===');
{
    const helpers = [];
    const fakeStorage = {
        addHelper: (helper, priority) => helpers.push({helper, priority}),
        createAsset: (assetType, dataFormat, data) => ({assetType, dataFormat, data, assetId: `md5-${data.length}`})
    };
    ok('初始没有注册 helper', helpers.length === 0);

    const asset = fakeStorage.createAsset('ImageVector', 'svg', '<svg/>');
    registerIconAsset(fakeStorage, asset);
    ok('登记后注册了一个 helper', helpers.length === 1);
    ok('优先级为正（排在默认 helper 之前）', helpers[0].priority > 0);

    registerIconAsset(fakeStorage, fakeStorage.createAsset('ImageVector', 'svg', '<svg>2</svg>'));
    ok('重复登记不会重复注册 helper', helpers.length === 1);

    const helper = helpers[0].helper;
    const hit = helper.load('ImageVector', asset.assetId);
    ok('命中的资源返回 Promise', hit && typeof hit.then === 'function');
    await hit.then(found => {
        ok('已登记的资源能被 helper 取回', found === asset);
    });

    // 血泪教训：必须「同步返回 null」。scratch-storage 里判断是
    // `if (loading === null) return tryNextHelper();`，返回 Promise.resolve(null)
    // 会被当成"找到了一个 null"，后面真正的 helper 再也不会被调用，
    // 结果是所有造型（包括普通角色）全部变成坏造型。
    const miss = helper.load('ImageVector', 'not-registered');
    ok('未登记必须同步返回 null（不能是 Promise）', miss === null);
}

try {
    fs.unlinkSync(temp);
} catch (e) {
    // ignore
}

console.log(`\n通过 ${pass}，失败 ${fail}`);
if (fail > 0) {
    process.exit(1);
}

