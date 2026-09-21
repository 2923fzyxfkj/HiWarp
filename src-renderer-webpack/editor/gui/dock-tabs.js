import {useEffect, useState} from 'react';

/**
 * 侧栏标签的「停靠 / 浮动」共享状态。
 *
 * 三个侧栏（AI 助手、文本编程、待办）以及以后新增的，都通过这里协调，
 * 这样每个侧栏内部不必自己维护一套拖出逻辑。
 *
 * 用模块级单例 + 订阅，而不是 React Context：标签组件分散在各侧栏组件树内部，
 * 跨树保持一致最省事的方式就是这个。
 *
 * **故意不持久化**：按需求，重启后所有标签一律归位，不保留浮动状态。
 * 标签的竖直位置由各自组件自己存 localStorage，与本文件无关。
 */

/** tabKey -> {key, label, side, top, onOpen} */
let undocked = {};
const listeners = new Set();

const emit = () => {
    for (const listener of Array.from(listeners)) listener();
};

export const subscribeDock = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const getUndocked = () => undocked;

export const undockTab = entry => {
    undocked = {...undocked, [entry.key]: entry};
    emit();
};

export const redockTab = key => {
    if (!(key in undocked)) return;
    const next = {...undocked};
    delete next[key];
    undocked = next;
    emit();
};

/** 订阅浮动标签集合。返回 tabKey -> entry。 */
export const useDockTabs = () => {
    const [state, setState] = useState(getUndocked);
    useEffect(() => subscribeDock(() => setState(getUndocked())), []);
    return state;
};

// ── 公共配色 ────────────────────────────────────────────────────
// 与 ai-sidebar.jsx 保持一致，这里作为唯一来源，避免散落的硬编码色值被改错：
//   侧栏面板  radial-gradient(at 82% 4%) + linear-gradient(#162a34 -> #0c171f)
//   强调/标签 linear-gradient(135deg, #1e91a4, #146f84)   ← 收起标签用的就是这个
export const ACCENT_FROM = '#1e91a4';
export const ACCENT_TO = '#146f84';
export const TEXT_COLOR = '#eef5fa';
export const PANEL_BG =
    'radial-gradient(circle at 82% 4%, rgba(58, 126, 132, 0.42) 0, transparent 32%), ' +
    'linear-gradient(180deg, #162a34 0%, #0c171f 100%)';
export const PANEL_SOLID = 'rgba(11, 24, 32, 0.66)';
export const ACCENT_GRADIENT = `linear-gradient(135deg, ${ACCENT_FROM}, ${ACCENT_TO})`;