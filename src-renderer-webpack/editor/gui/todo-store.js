/**
 * 待办清单的数据层。
 *
 * 纯函数，不依赖 React / VM，方便单独推理和测试。
 *
 * 存储形态：**扁平数组 + parent 引用**，而不是嵌套树。
 * 理由：拖动是「改一个 parent + 重排 order」，扁平结构下只是一次 map，
 * 嵌套树则要递归查找、删除、插入三处，出错面大得多。
 *
 * 数据落在 project.json 的顶层字段 `hiwarpTodos`（见 patches 里对
 * scratch-vm/src/serialization/sb3.js 的补丁，照上游 customFonts 的样板写的）。
 * 其他编辑器（TurboWarp / Scratch）的反序列化只读已知字段，会静默忽略它。
 */

export const STORAGE_VERSION = 1;

let seed = 0;
const newId = () => {
    seed += 1;
    return `hw${Date.now().toString(36)}${seed.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};

export const emptyState = () => ({version: STORAGE_VERSION, items: []});

/**
 * 把任意输入收敛成合法状态。
 * 设计原则：**坏数据只丢自己，绝不抛异常**。宁可少显示几条待办，
 * 也不能让一个畸形字段把整个编辑器搞崩（本项目已经在这上面吃过亏）。
 */
export const normalizeState = raw => {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return emptyState();

    const items = [];
    const seen = new Set();
    for (const entry of raw.items) {
        if (!entry || typeof entry !== 'object') continue;
        if (typeof entry.id !== 'string' || !entry.id || seen.has(entry.id)) continue;
        seen.add(entry.id);
        const type = entry.type === 'category' ? 'category' : 'todo';
        items.push({
            id: entry.id,
            type,
            text: typeof entry.text === 'string' ? entry.text : '',
            done: type === 'todo' && entry.done === true,
            parent: typeof entry.parent === 'string' ? entry.parent : null,
            order: Number.isFinite(entry.order) ? entry.order : items.length,
            collapsed: type === 'category' && entry.collapsed === true
        });
    }

    const byId = new Map(items.map(item => [item.id, item]));

    for (const item of items) {
        // parent 指向不存在的项 -> 提到根
        if (item.parent && !byId.has(item.parent)) item.parent = null;
        // 只有分类能当容器
        if (item.parent && byId.get(item.parent).type !== 'category') item.parent = null;
    }

    // 断开环（理论上不该出现，但坏数据必须能活着读进来）
    for (const item of items) {
        const chain = new Set([item.id]);
        let cursor = item.parent;
        while (cursor) {
            if (chain.has(cursor)) {
                item.parent = null;
                break;
            }
            chain.add(cursor);
            const parent = byId.get(cursor);
            cursor = parent ? parent.parent : null;
        }
    }

    return {version: STORAGE_VERSION, items};
};

/** 某个容器下的直接子项，按 order 升序。parentId 为 null 表示根层。 */
export const childrenOf = (state, parentId) =>
    state.items
        .filter(item => item.parent === parentId)
        .sort((a, b) => a.order - b.order);

/** nodeId 是否位于 ancestorId 的子树里（用于阻止把分类拖进自己的后代）。 */
export const isDescendant = (state, ancestorId, nodeId) => {
    const byId = new Map(state.items.map(item => [item.id, item]));
    let cursor = byId.get(nodeId);
    while (cursor && cursor.parent) {
        if (cursor.parent === ancestorId) return true;
        cursor = byId.get(cursor.parent);
    }
    return false;
};

const addItem = (state, type, parentId) => {
    const parent = parentId && state.items.some(item => item.id === parentId && item.type === 'category') ?
        parentId : null;
    const siblings = state.items.filter(item => item.parent === parent);
    const order = siblings.length ? Math.max(...siblings.map(item => item.order)) + 1 : 0;
    const item = {
        id: newId(),
        type,
        text: '',
        done: false,
        parent,
        order,
        collapsed: false
    };
    return {...state, items: state.items.concat(item)};
};

export const addTodo = (state, parentId = null) => addItem(state, 'todo', parentId);
export const addCategory = (state, parentId = null) => addItem(state, 'category', parentId);

export const updateItem = (state, id, patch) => ({
    ...state,
    items: state.items.map(item => (item.id === id ? {...item, ...patch} : item))
});

/** 删除一项，并连带删除它的整棵子树。 */
export const removeItem = (state, id) => {
    const doomed = new Set([id]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const item of state.items) {
            if (item.parent && doomed.has(item.parent) && !doomed.has(item.id)) {
                doomed.add(item.id);
                grew = true;
            }
        }
    }
    return {...state, items: state.items.filter(item => !doomed.has(item.id))};
};

/**
 * 把 id 移动到 newParentId 下的第 index 位。
 *
 * 三种会被拒绝的情形：拖到自己身上、拖进自己的后代（会成环）、目标不存在。
 * 拒绝时原样返回，调用方无需特判。
 */
export const moveItem = (state, id, newParentId, index) => {
    const item = state.items.find(candidate => candidate.id === id);
    if (!item) return state;
    if (newParentId === id) return state;
    if (newParentId && isDescendant(state, id, newParentId)) return state;

    const parent = newParentId &&
        state.items.some(candidate => candidate.id === newParentId && candidate.type === 'category') ?
        newParentId : null;

    const siblings = state.items
        .filter(candidate => candidate.parent === parent && candidate.id !== id)
        .sort((a, b) => a.order - b.order);

    const at = Number.isInteger(index) ? Math.max(0, Math.min(index, siblings.length)) : siblings.length;
    siblings.splice(at, 0, item);

    const orderById = new Map();
    siblings.forEach((candidate, position) => orderById.set(candidate.id, position));

    return {
        ...state,
        items: state.items.map(candidate => {
            // 注意：被移动的那一项既要改 parent **也要**改 order。
            // 早期版本只改了 parent，导致它保留旧序号、排序时不生效。
            const patch = {};
            if (candidate.id === id) patch.parent = parent;
            if (orderById.has(candidate.id)) patch.order = orderById.get(candidate.id);
            return Object.keys(patch).length ? {...candidate, ...patch} : candidate;
        })
    };
};

/** 完成度统计，给面板底部的状态栏用。 */
export const countItems = state => {
    let todo = 0;
    let done = 0;
    let category = 0;
    for (const item of state.items) {
        if (item.type === 'category') {
            category += 1;
        } else {
            todo += 1;
            if (item.done) done += 1;
        }
    }
    return {todo, done, category};
};

// ── 与 VM 的桥接 ────────────────────────────────────────────────

export const readFromRuntime = vm =>
    normalizeState(vm && vm.runtime ? vm.runtime.hiwarpTodos : null);

/**
 * 写回 runtime。空清单写 null —— 这样序列化时会跳过该字段，
 * 让「没有待办的项目」保持和其他编辑器产出的文件完全一致。
 */
export const writeToRuntime = (vm, state) => {
    if (!vm || !vm.runtime) return;
    vm.runtime.hiwarpTodos = state && state.items.length ? state : null;
};