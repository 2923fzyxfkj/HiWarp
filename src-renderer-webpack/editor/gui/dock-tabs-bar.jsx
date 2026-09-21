import React, {useEffect, useState} from 'react';
import {ACCENT_GRADIENT, PANEL_SOLID, TEXT_COLOR, redockTab, useDockTabs} from './dock-tabs.js';

/**
 * 浮动标签栏：显示被拖出来的标签。
 *
 * 位置：按需求做成**浮层**，浮在积木编辑区底部，不改动 scratch-gui 的布局
 * （改布局要再打一个 gui.css 补丁，回归面太大）。积木区的高度由 flex 撑满，
 * 下面本来没有空位，所以这里用 getBoundingClientRect 量出积木区，
 * 把栏贴到它的底边上；窗口尺寸变化时重新量。
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

const measureBlocksArea = () => {
    // 积木区在 scratch-gui 里是 .blocks-wrapper（CSS Modules 会加哈希后缀）
    const element = document.querySelector('[class*="blocks-wrapper"]');
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.bottom
    };
};

const DockTabsBar = () => {
    const undocked = useDockTabs();
    const [area, setArea] = useState(measureBlocksArea);
    const keys = Object.keys(undocked);

    useEffect(() => {
        const remeasure = () => setArea(measureBlocksArea());
        remeasure();
        window.addEventListener('resize', remeasure);
        return () => window.removeEventListener('resize', remeasure);
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