/**
 * 把 @material-symbols/svg-400 的图标归档进 dist-library-files。
 *
 * 用法: node scripts/prepare-material-symbols.mjs
 * 由 `npm run fetch` 调用（放在扩展库之后）。
 *
 * 产物:
 *   dist-library-files/material-symbols/index.json     清单（名称、数量、版本、许可证）
 *   dist-library-files/material-symbols/<style>.json   图标归档 { "<name>": "<svg>" }
 *   dist-library-files/material-symbols/LICENSE
 *
 * 为什么不再是每个图标一个 .svg 文件:
 *   23,622 个小文件会把打包/压缩/rsync 全部退化成 inode 操作（12.7 MB 数据、
 *   23,622 个节点）。按风格归档成 3 个 JSON 后节点数从 23,622 降到 4，
 *   electron-builder 的每次封装、WSL 的每次同步都受益。
 *
 * 实心变体是同一目录下的 `<name>-fill.svg`，归档里以 `<name>-fill` 作为键。
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const source = path.join(root, 'node_modules', '@material-symbols', 'svg-400');
const target = path.join(root, 'dist-library-files', 'material-symbols');
const STYLES = ['outlined', 'rounded', 'sharp'];
const FILL_SUFFIX = '-fill';

if (!fs.existsSync(source)) {
  console.error('[material-symbols] 缺少依赖 node_modules/@material-symbols/svg-400');
  console.error('[material-symbols] 请先 npm install，再重试');
  process.exit(1);
}

fs.rmSync(target, {recursive: true, force: true});
fs.mkdirSync(target, {recursive: true});

const version = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8')).version;
const manifest = {
  package: '@material-symbols/svg-400',
  version,
  license: 'Apache-2.0',
  styles: STYLES,
  fillSuffix: FILL_SUFFIX,
  // 每个风格下的基础图标名（实心是 <name>-fill.svg）
  icons: {},
  counts: {}
};

for (const style of STYLES) {
  const from = path.join(source, style);
  const files = fs.readdirSync(from).filter(file => file.endsWith('.svg'));
  const archive = {};
  const baseNames = [];

  for (const file of files) {
    const key = file.slice(0, -'.svg'.length);
    archive[key] = fs.readFileSync(path.join(from, file), 'utf8');
    if (!file.endsWith(`${FILL_SUFFIX}.svg`)) {
      baseNames.push(key);
    }
  }

  baseNames.sort();
  const archivePath = path.join(target, `${style}.json`);
  fs.writeFileSync(archivePath, JSON.stringify(archive), 'utf8');
  manifest.icons[style] = baseNames;
  manifest.counts[style] = {
    icons: baseNames.length,
    files: files.length
  };
  console.log(
    `[material-symbols] ${style}: ${baseNames.length} 个图标 / ${files.length} 个文件 -> ` +
    `${(fs.statSync(archivePath).size / 1024 / 1024).toFixed(2)} MB`
  );
}

// 许可证必须随素材一起分发（Apache-2.0 的要求）
const licenseFile = path.join(source, 'LICENSE');
if (!fs.existsSync(licenseFile)) {
  console.error('[material-symbols] 依赖里缺少 LICENSE，不能继续');
  process.exit(1);
}
fs.copyFileSync(licenseFile, path.join(target, 'LICENSE'));

fs.writeFileSync(path.join(target, 'index.json'), JSON.stringify(manifest), 'utf8');
console.log(`[material-symbols] 完成 -> dist-library-files/material-symbols（v${version}，共 ${fs.readdirSync(target).length} 个文件）`);
