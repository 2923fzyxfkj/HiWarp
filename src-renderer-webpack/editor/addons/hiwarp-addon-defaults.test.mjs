/**
 * hiwarp-addon-defaults.js 的单元测试。
 *
 * 用法: node src-renderer-webpack/editor/addons/hiwarp-addon-defaults.test.mjs
 *
 * 为什么要拷到临时目录：源文件是 ESM，而 package.json 没有 "type": "module"，
 * node 会把 .js 当 CommonJS 解析，直接 import 会报 "Unexpected token 'export'"。
 * （与 todo-store.test.mjs 相同的手法。）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), 'hiwarp-addon-defaults.js');
const temp = path.join(os.tmpdir(), `hiwarp-addon-defaults-${process.pid}.mjs`);
fs.copyFileSync(source, temp);

const {seedAddonDefaults, DEFAULT_ENABLED_ADDONS, applyAddonDefaults} = await import(pathToFileURL(temp).href);

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

const id = DEFAULT_ENABLED_ADDONS[0];

console.log('=== 1. 存储为空：种入默认值 ===');
{
  const {store, changed} = seedAddonDefaults(null);
  ok('空存储被判为需要写入', changed);
  ok('默认 id 被开启', store[id].enabled === true);
  ok('所有默认 id 都被开启', DEFAULT_ENABLED_ADDONS.every(x => store[x] && store[x].enabled === true));
  ok('补上了版本号', store._ === 5);
}

console.log('=== 2. 用户明确关闭过：不覆盖 ===');
{
  const raw = JSON.stringify({_: 5, [id]: {enabled: false, rows: 3}});
  const {store, changed} = seedAddonDefaults(raw);
  ok('enabled:false 被保留', store[id].enabled === false);
  ok('其它设置字段被保留', store[id].rows === 3);
  ok('仍然补齐了缺失的默认 id', store[DEFAULT_ENABLED_ADDONS[1]].enabled === true);
  ok('有缺失所以 changed 为真', changed);
}

console.log('=== 3. 全部已存在：幂等，不重复写 ===');
{
  const first = seedAddonDefaults(null).store;
  const second = seedAddonDefaults(JSON.stringify(first));
  ok('第二次不再改变', !second.changed);
  ok('内容完全相同', JSON.stringify(second.store) === JSON.stringify(first));
}

console.log('=== 4. 存储损坏：重建而不是抛异常 ===');
{
  ok('非法 JSON 不抛', (() => {
    try {
      seedAddonDefaults('{not json');
      return true;
    } catch (e) {
      return false;
    }
  })());
  ok('非法 JSON 被重建为默认表', seedAddonDefaults('{not json').store[id].enabled === true);
  ok('数组被当作空表', seedAddonDefaults('[]').store[id].enabled === true);
  ok('字符串被当作空表', seedAddonDefaults('"abc"').store[id].enabled === true);
  ok('数字被当作空表', seedAddonDefaults('42').store[id].enabled === true);
}

console.log('=== 4b. enabled 是坏值：按缺失处理 ===');
{
  // 上游 getAddonEnabled 只要发现 enabled 字段存在就返回它，所以 null/字符串
  // 会让插件永远打不开——这里必须当成缺失，覆盖成 true。
  const bad = JSON.stringify({_: 5, [id]: {enabled: null}});
  ok('null 被当成缺失', seedAddonDefaults(bad).store[id].enabled === true);
  ok('字符串被当成缺失', seedAddonDefaults(JSON.stringify({_: 5, [id]: {enabled: 'yes'}})).store[id].enabled === true);
  ok('数字被当成缺失', seedAddonDefaults(JSON.stringify({_: 5, [id]: {enabled: 0}})).store[id].enabled === true);
  ok('加载项条目本身是字符串时重建', seedAddonDefaults(JSON.stringify({_: 5, [id]: 'oops'})).store[id].enabled === true);
}

console.log('=== 5. 不污染无关数据 ===');{
  const raw = JSON.stringify({_: 5, 'some-other-addon': {enabled: true, mode: 'x'}, [id]: {enabled: true}});
  const {store} = seedAddonDefaults(raw);
  ok('其它加载项原样保留', store['some-other-addon'].mode === 'x');
  ok('已有版本号不被改写', store._ === 5);
}

console.log('=== 6. 已存在版本号时不覆盖 ===');
{
  const {store, changed} = seedAddonDefaults(JSON.stringify({_: 4}));
  ok('旧版本号保留给上游迁移', store._ === 4);
  ok('默认值仍然种入', store[id].enabled === true);
  ok('changed 为真', changed);
}

console.log('=== 7. 默认表本身 ===');
{
  ok('默认表非空', DEFAULT_ENABLED_ADDONS.length > 0);
  ok('默认表无重复 id', new Set(DEFAULT_ENABLED_ADDONS).size === DEFAULT_ENABLED_ADDONS.length);
  ok('默认表全是字符串', DEFAULT_ENABLED_ADDONS.every(x => typeof x === 'string' && x.length > 0));
}

console.log('=== 8. 无 localStorage 环境下不崩 ===');
{
  ok('applyAddonDefaults 安全返回 false', applyAddonDefaults() === false);
}

console.log('=== 9. 插件内部参数也补齐 ===');
{
  const {store} = seedAddonDefaults(null);
  ok('custom-block-shape 圆角补成 300', store['custom-block-shape'].cornerSize === 300);
  ok('custom-block-shape 缺口补成 0', store['custom-block-shape'].notchSize === 0);
  ok('参数所属插件保持开启', store['custom-block-shape'].enabled === true);

  const kept = seedAddonDefaults(JSON.stringify({_: 5, 'custom-block-shape': {cornerSize: 150}})).store;
  ok('已有的 150 不被覆盖', kept['custom-block-shape'].cornerSize === 150);
  ok('缺失的 notchSize 仍被补齐', kept['custom-block-shape'].notchSize === 0);

  const off = seedAddonDefaults(JSON.stringify({_: 5, 'custom-block-shape': {enabled: false}})).store;
  ok('关着的插件仍会补参数', off['custom-block-shape'].cornerSize === 300);
  ok('但不会因此被打开', off['custom-block-shape'].enabled === false);

  ok('含参数后仍然幂等', !seedAddonDefaults(JSON.stringify(seedAddonDefaults(null).store)).changed);
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
