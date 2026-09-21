/**
 * todo-store.js 的单元测试。
 *
 * 用法: node src-renderer-webpack/editor/gui/todo-store.test.mjs
 *
 * 为什么要拷到临时目录：todo-store.js 是 ESM，但 package.json 没有
 * "type": "module"，node 会把 .js 当 CommonJS 解析，直接 import 会报
 * "Unexpected token 'export'"。拷成 .mjs 就能正常动态导入。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// 注意：不能用 URL.pathname —— Windows 上它返回的是百分号编码过的路径
// （比如 "HiWarp%20Desktop"），必须用 fileURLToPath。
const source = path.join(path.dirname(fileURLToPath(import.meta.url)), 'todo-store.js');
const temp = path.join(os.tmpdir(), `hiwarp-todo-store-${process.pid}.mjs`);
fs.copyFileSync(source, temp);

const {
    normalizeState, childrenOf, addTodo, addCategory, updateItem, removeItem,
    moveItem, isDescendant, countItems, emptyState
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

console.log('=== 1. normalizeState：坏数据不能抛、不能崩结构 ===');
ok('null -> 空', normalizeState(null).items.length === 0);
ok('字符串 -> 空', normalizeState('nope').items.length === 0);
ok('items 非数组 -> 空', normalizeState({items: 1}).items.length === 0);
ok('数组里塞垃圾 -> 跳过', normalizeState({items: [null, 1, 'x', {}]}).items.length === 0);
ok('缺 id -> 跳过', normalizeState({items: [{type: 'todo', text: 'a'}]}).items.length === 0);
ok('重复 id -> 只留一个', normalizeState({items: [{id: 'a'}, {id: 'a'}]}).items.length === 1);
ok('parent 指向不存在 -> 提到根', normalizeState({items: [{id: 'a', parent: 'zzz'}]}).items[0].parent === null);
ok('parent 指向 todo -> 提到根', normalizeState({items: [{id: 'a'}, {id: 'b', parent: 'a'}]})
    .items.find(i => i.id === 'b').parent === null);

console.log('=== 2. 自环 / 多级环 要被断开 ===');
ok('自环 -> parent 置空', normalizeState({items: [{id: 'a', type: 'category', parent: 'a'}]}).items[0].parent === null);
ok('a<->b 环 -> 断开', normalizeState({items: [
    {id: 'a', type: 'category', parent: 'b'},
    {id: 'b', type: 'category', parent: 'a'}
]}).items.some(i => i.parent === null));

console.log('=== 3. 增删改 ===');
let s = emptyState();
s = addTodo(s); s = addTodo(s); s = addCategory(s);
ok('3 项', s.items.length === 3);
ok('根层顺序稳定', childrenOf(s, null).map(i => i.type).join(',') === 'todo,todo,category');
const catId = s.items.find(i => i.type === 'category').id;
s = updateItem(s, catId, {text: '分类A'});
ok('改名生效', s.items.find(i => i.id === catId).text === '分类A');
ok('countItems', JSON.stringify(countItems(s)) === '{"todo":2,"done":0,"category":1}');

console.log('=== 4. 待办拖进分类 ===');
const todoId = s.items.find(i => i.type === 'todo').id;
s = moveItem(s, todoId, catId, 0);
ok('parent 变成分类', s.items.find(i => i.id === todoId).parent === catId);
ok('childrenOf(分类) 能找到', childrenOf(s, catId).some(i => i.id === todoId));

console.log('=== 5. 分类嵌套 + 成环防护（关键）===');
let s2 = emptyState();
s2 = addCategory(s2); s2 = addCategory(s2); s2 = addCategory(s2);
const c1 = s2.items[0].id;
const c2 = s2.items[1].id;
const c3 = s2.items[2].id;
s2 = moveItem(s2, c2, c1, 0);
ok('c2 成为 c1 子项', s2.items.find(i => i.id === c2).parent === c1);
s2 = moveItem(s2, c3, c2, 0);
ok('c3 成为 c2 子项（两层）', s2.items.find(i => i.id === c3).parent === c2);
ok('isDescendant(c1,c3) 为真', isDescendant(s2, c1, c3) === true);
const before = JSON.stringify(s2);
ok('祖先拖进后代 -> 拒绝', JSON.stringify(moveItem(s2, c1, c3, 0)) === before);
ok('拖到自己身上 -> 拒绝', JSON.stringify(moveItem(s2, c1, c1, 0)) === before);

console.log('=== 6. 删除连带子树 ===');
ok('删 c1 -> 子孙全清', removeItem(s2, c1).items.length === 0);

console.log('=== 7. 顺序重排（曾经的真实 bug）===');
let s4 = emptyState();
s4 = addTodo(s4); s4 = addTodo(s4); s4 = addTodo(s4);
const ids = childrenOf(s4, null).map(i => i.id);
s4 = moveItem(s4, ids[2], null, 0);
ok('最后一个拖到最前', childrenOf(s4, null).map(i => i.id).join(',') === [ids[2], ids[0], ids[1]].join(','));

fs.unlinkSync(temp);

console.log('');
console.log('通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);