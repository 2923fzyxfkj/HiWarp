import React, {useEffect, useState} from 'react';
import {ACCENT_GRADIENT, PANEL_SOLID, TEXT_COLOR, redockTab, useDockTabs} from './dock-tabs.js';

/**
 * 浮动标签栏：显示被拖出来的标签。
 *
 * 位置：按需求做成**浮层**，只压在**编辑区**（拼积木的画布）底部，
 * 不覆盖左侧的**积木区**（分类栏 + 积木列表）。两者在 DOM 里没有各自独立的
 * 容器 —— Blockly 把整个积木区渲染在一个 injectionDiv 里 —— 但积木列表是
 * `.blocklyFlyout`（见 scratch-gui 的 blocks.css），**它的右边缘就是分界**，
 * 所以用它来切分。
 *
 * 不做布局改动（改布局要再打一个 gui.css 补丁，回归面太大），仍是浮层。
 *
 * 点击栏里的标签 = 让它回到原来的边缘与高度（redockTab），不直接展开面板。
 */
const BAR_HEIGHT = 34;

const barStyle = {
    position: 'fixed',
    zIndex: 10002,
    height: `${BAR_HEIGHT}px`,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0 0.5rem',
    boxSizing: 'border-box',
    background: PANEL_SOLID,
    borderTop: '1px solid rgba(143, 205, 214, 0.2)',
    color: TEXT_COLOR,
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: '0.78rem',
    overflowX: 'auto'
};

const itemStyle = {
    border: 0,
    borderRadius: '999px',
    padding: '0.22rem 0.6rem',
    background: ACCENT_GRADIENT,
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontSize: '0.76rem'
};

const hintStyle = {
    opacity: 0.6,
    marginLeft: '0.2rem',
    whiteSpace: 'nowrap'
};

/**
 * 量出「编辑区」的矩形。
 *
 * 整个积木区 = [分类栏][积木列表 flyout][编辑区画布]。
 * 前三者都在同一个 Blockly 容器里，没有独立元素，但 flyout 有 class，
 * 它的右边缘即分界；因此 left 取 flyout.right，width 取到积木区右边缘。
 * flyout 不存在或量不到时退回积木区整体（宁可盖住一点，也不要整条消失）。
 */
const measureEditorArea = () => {
    const element = document.querySelector('[class*="blocks-wrapper"]');
    if (!element) return null;
    const full = element.getBoundingClientRect();
    if (!full.width || !full.height) return null;

    let left = full.left;
    const flyout = document.querySelector('.blocklyFlyout');
    if (flyout) {
        const flyoutRect = flyout.getBoundingClientRect();
        if (flyoutRect.width > 0 && flyoutRect.right > full.left && flyoutRect.right < full.right) {
            left = flyoutRect.right;
        }
    }

    return {
        left,
        width: full.right - left,
        bottom: window.innerHeight - full.bottom
    };
};

const DockTabsBar = () => {
    const undocked = useDockTabs();
    const [area, setArea] = useState(measureEditorArea);
    const keys = Object.keys(undocked);

    useEffect(() => {
        if (!keys.length) return undefined;
        const remeasure = () => {
            const next = measureEditorArea();
            if (!next) return;
            // 只在真的变了时才 setState，避免每秒无谓重渲染
            setArea(previous => {
                if (previous &&
                    Math.abs(previous.left - next.left) < 1 &&
                    Math.abs(previous.width - next.width) < 1 &&
                    Math.abs(previous.bottom - next.bottom) < 1) {
                    return previous;
                }
                return next;
            });
        };
        remeasure();
        // 切换积木分类时 flyout 宽度会变，分界跟着动，所以定时重新量
        const timer = setInterval(remeasure, 1000);
        window.addEventListener('resize', remeasure);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', remeasure);
        };
    }, [keys.length]);

    if (!keys.length || !area) return null;

    return (
        <div style={{...barStyle, left: `${area.left}px`, width: `${area.width}px`, bottom: `${area.bottom}px`}}>
            {keys.map(key => (
                <button
                    key={key}
                    type="button"
                    style={itemStyle}
                    title="点击让它回到原来的位置"
                    onClick={() => redockTab(key)}
                >
                    {undocked[key].label}
                </button>
            ))}
            <span style={hintStyle}>点击标签让它归位</span>
        </div>
    );
};

export default DockTabsBar;