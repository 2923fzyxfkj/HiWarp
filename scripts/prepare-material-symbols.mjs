/**
 * 把 @material-symbols/svg-400 的 SVG 复制进 dist-library-files，
 * 并生成角色库用的图标清单。
 *
 * 用法: node scripts/prepare-material-symbols.mjs
 * 由 `npm run fetch` 调用（放在扩展库之后）。
 *
 * 产物:
 *   dist-library-files/material-symbols/index.json      清单（含数量/版本/许可证）
 *   dist-library-files/material-symbols/<style>/<file>.svg
 *   dist-library-files/material-symbols/LICENSE
 *
 * 设计说明:
 *   - 三个风格（outlined/rounded/sharp）各自一套目录；实心是同一目录下的
 *     `<name>-fill.svg`，所以清单里只记基础名，填充与否由调用方拼后缀。
 *   - 不做 brotli：SVG 本身很小，且这些文件由 tw-library:// 直接按文件返回。
 *   - 依赖缺失时不静默跳过：加载项库缺素材会表现成"选项卡空白"，难排查。
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
  const to = path.join(target, style);
  fs.mkdirSync(to, {recursive: true});

  const files = fs.readdirSync(from).filter(file => file.endsWith('.svg'));
  const baseNames = [];
  let copied = 0;

  for (const file of files) {
    fs.copyFileSync(path.join(from, file), path.join(to, file));
    copied++;
    if (!file.endsWith(`${FILL_SUFFIX}.svg`)) {
      baseNames.push(file.slice(0, -'.svg'.length));
    }
  }

  baseNames.sort();
  manifest.icons[style] = baseNames;
  manifest.counts[style] = {
    icons: baseNames.length,
    files: copied
  };
  console.log(`[material-symbols] ${style}: ${baseNames.length} 个图标 / ${copied} 个文件`);
}

// 许可证必须随素材一起分发（Apache-2.0 的要求）
const licenseFile = path.join(source, 'LICENSE');
if (!fs.existsSync(licenseFile)) {
  console.error('[material-symbols] 依赖里缺少 LICENSE，不能继续');
  process.exit(1);
}
fs.copyFileSync(licenseFile, path.join(target, 'LICENSE'));

fs.writeFileSync(path.join(target, 'index.json'), JSON.stringify(manifest), 'utf8');
console.log(`[material-symbols] 完成 -> dist-library-files/material-symbols（v${version}）`);
