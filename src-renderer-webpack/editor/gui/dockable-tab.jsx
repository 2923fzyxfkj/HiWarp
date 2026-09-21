import React, {useCallback, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import {ACCENT_GRADIENT, redockTab, undockTab, useDockTabs} from './dock-tabs.js';

/** 水平拖动超过这个距离就算「把标签拖出来」。 */
const PULL_THRESHOLD = 60;
/** 小于这个位移视为点击，不视为拖动。 */
const MOVE_THRESHOLD = 4;
/** 竖直位置的边界，与 ai-sidebar.jsx 的 startTabDrag 一致。 */
const EDGE_MARGIN = 24;
const BOTTOM_RESERVE = 120;

const baseStyle = {
    position: 'fixed',
    zIndex: 10001,
    minHeight: '2.2rem',
    padding: '0.85rem 0.6rem',
    border: 0,
    background: ACCENT_GRADIENT,
    color: '#ffffff',
    fontWeight: 600,
    writingMode: 'vertical-rl',
    letterSpacing: '0.08em',
    userSelect: 'none',
    touchAction: 'none',
    font: 'inherit',
    cursor: 'grab'
};

/** 左侧贴左边缘、右侧贴右边缘；圆角与阴影朝各自外侧。 */
const sideStyle = side => (side === 'left' ?
    {left: 0, borderRadius: '0 1rem 1rem 0', boxShadow: '8px 10px 28px rgba(8, 39, 47, 0.34)'} :
    {right: 0, borderRadius: '1rem 0 0 1rem', boxShadow: '-8px 10px 28px rgba(8, 39, 47, 0.34)'});

const clampTop = top => {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    return Math.max(EDGE_MARGIN, Math.min(Math.max(EDGE_MARGIN, viewportHeight - BOTTOM_RESERVE), top));
};

const topKey = tabKey => `hiwarp:tab-top:${tabKey}`;

/**
 * 可停靠 / 可拖出的侧栏标签。
 *
 * 交互（按需求定义）：
 *  - 竖直拖   -> 沿边缘平移标签，位置存 localStorage（重启后仍在原处）
 *  - 水平拖超过 PULL_THRESHOLD -> 进入「拖出」态（跟随光标横向偏移、半透明）
 *  - 松手时若处于拖出态 -> 标签从边缘消失，改由 DockTabsBar 显示
 *  - 点击不动 -> 由 onOpen 打开对应面板
 *  - 从浮动栏点回来 -> 回到**拖走之前的高度**（所以高度一直记在 localStorage 里）
 */
const DockableTab = ({tabKey, label, side, defaultTopRatio, onOpen}) => {
    const undocked = useDockTabs();
    const [top, setTop] = useState(() => {
        try {
            const stored = Number(localStorage.getItem(topKey(tabKey)));
            if (Number.isFinite(stored) && stored >= EDGE_MARGIN) return clampTop(stored);
        } catch (e) {
            // 忽略：读不到就用默认值
        }
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
        return clampTop(viewportHeight * defaultTopRatio);
    });
    const [pullOffset, setPullOffset] = useState(null);

    const dragRef = useRef(null);

    const rememberTop = useCallback(value => {
        try {
            localStorage.setItem(topKey(tabKey), String(Math.round(value)));
        } catch (e) {
            // 忽略：存不下也不影响本次会话
        }
    }, [tabKey]);

    const handlePointerDown = useCallback(event => {
        if (event.button !== 0) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startTop: rect.top,
            moved: false,
            pulled: false
        };
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch (e) {
            // 忽略
        }
    }, []);

    const handlePointerMove = useCallback(event => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;

        if (Math.abs(deltaX) > PULL_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
            // 横向占优且超过阈值 -> 拖出
            drag.pulled = true;
            drag.moved = true;
            setPullOffset(deltaX);
            return;
        }

        if (Math.abs(deltaY) > MOVE_THRESHOLD) {
            drag.moved = true;
            setTop(clampTop(drag.startTop + deltaY));
        }
    }, []);

    const finish = useCallback((event, cancelled) => {
        const drag = dragRef.current;
        dragRef.current = null;
        setPullOffset(null);
        if (event && event.currentTarget && event.pointerId !== undefined) {
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch (e) {
                // 忽略
            }
        }
        if (!drag || cancelled) return;

        if (drag.pulled) {
            // 松手才真正变成浮动栏，并把「拖走前的高度」一起记进去，供点回来时使用
            rememberTop(top);
            undockTab({key: tabKey, label, side, top, onOpen});
            return;
        }
        if (drag.moved) {
            rememberTop(top);
            return;
        }
        onOpen();
    }, [label, onOpen, rememberTop, side, tabKey, top]);

    // 已经浮到栏里了就不在边缘显示
    if (undocked[tabKey]) return null;

    return (
        <button
            type="button"
            aria-label={`打开 ${label}`}
            title="点击展开；上下拖动可移动；左右拖出可收进浮动栏"
            style={{
                ...baseStyle,
                ...sideStyle(side),
                top: `${top}px`,
                transform: pullOffset === null ? 'none' : `translateX(${pullOffset}px)`,
                opacity: pullOffset === null ? 1 : 0.72,
                cursor: pullOffset === null ? 'grab' : 'grabbing'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={event => {
                // 用 pointerup 而不是 click：拖动后也会触发 click，会误开面板
                finish(event, false);
                // 从浮动栏点回来之后也要能正常打开，所以这里保留 onOpen 语义由 finish 决定
            }}
            onPointerCancel={event => finish(event, true)}
        >
            {label}
        </button>
    );
};

DockableTab.propTypes = {
    tabKey: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    side: PropTypes.oneOf(['left', 'right']),
    defaultTopRatio: PropTypes.number,
    onOpen: PropTypes.func
};

DockableTab.defaultProps = {
    side: 'right',
    defaultTopRatio: 0.42,
    onOpen: () => {}
};

export default DockableTab;