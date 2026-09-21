import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import DockableTab from './dockable-tab.jsx';
import {
    addCategory,
    addTodo,
    childrenOf,
    countItems,
    moveItem,
    readFromRuntime,
    removeItem,
    updateItem,
    writeToRuntime
} from './todo-store.js';
import {ACCENT_FROM, ACCENT_TO, PANEL_BG, TEXT_COLOR} from './dock-tabs.js';

// ── 配色：统一从 dock-tabs.js 导入（唯一来源）────────────────────
// 全部取自 ai-sidebar.jsx，不要凭印象改：
//   面板背景  radial-gradient(rgba(58,126,132,.42) at 82% 4%) + linear-gradient(#162a34 -> #0c171f)
//   强调渐变  linear-gradient(135deg, #1e91a4, #146f84)   ← 中点约 #198099
//   正文色    #eef5fa
// 注意径向高光的 82% 4%：它对齐的是**右侧停靠**。本面板停靠在左侧，
// 早期版本把它镜像成 18% 4%，结果和 AI 侧栏并排看颜色"不对"。现按原值保留，
// 因为要的是"看起来一样"，而不是"几何对称"。


const PANEL_WIDTH = '22rem';
const LONG_PRESS_MS = 250;

const panelStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    maxWidth: '94vw',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    background: PANEL_BG,
    color: TEXT_COLOR,
    boxShadow: '18px 0 48px rgba(3, 14, 21, 0.46)',
    borderRight: '1px solid rgba(154, 218, 222, 0.24)',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: '0.86rem'
};

// 收起状态的标签。**注意：它不是面板那个深色渐变，而是强调青色。**
// 依据 ai-sidebar.jsx：tabButtonBaseStyle 继承 buttonStyle，而 buttonStyle 是
//   background: linear-gradient(135deg, #1e91a4, #146f84); color: #ffffff
// 早期版本错把面板的深色渐变用在这里，所以看起来"颜色不对"。
// 本面板停在左侧，故把 AI 侧栏的圆角与阴影做水平镜像（原来朝右，现朝左）。
const tabStyle = {
    position: 'fixed',
    left: 0,
    zIndex: 10001,
    minHeight: '2.2rem',
    padding: '0.85rem 0.6rem',
    border: 0,
    borderRadius: '0 1rem 1rem 0',
    background: `linear-gradient(135deg, ${ACCENT_FROM}, ${ACCENT_TO})`,
    color: '#ffffff',
    fontWeight: 600,
    boxShadow: '8px 10px 28px rgba(8, 39, 47, 0.34)',
    cursor: 'pointer',
    writingMode: 'vertical-rl',
    letterSpacing: '0.08em',
    userSelect: 'none',
    touchAction: 'none',
    font: 'inherit'
};

const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.4rem',
    padding: '0.6rem 0.7rem',
    borderBottom: '1px solid rgba(143, 205, 214, 0.2)'
};

const buttonStyle = {
    border: '1px solid rgba(113, 158, 174, 0.42)',
    borderRadius: '0.45rem',
    background: 'rgba(8, 21, 29, 0.78)',
    color: '#eef5fa',
    padding: '0.3rem 0.55rem',
    cursor: 'pointer',
    fontSize: '0.78rem'
};

const primaryButtonStyle = {
    ...buttonStyle,
    border: 'none',
    background: `linear-gradient(135deg, ${ACCENT_FROM}, ${ACCENT_TO})`,
    color: '#ffffff'
};

const listStyle = {flex: 1, overflowY: 'auto', padding: '0.5rem'};

const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.3rem 0.35rem',
    borderRadius: '0.45rem',
    background: 'rgba(17, 34, 44, 0.76)',
    border: '1px solid rgba(142, 195, 205, 0.18)',
    marginBottom: '0.3rem'
};

const handleStyle = {
    flex: '0 0 auto',
    cursor: 'grab',
    color: 'rgba(210, 225, 231, 0.55)',
    padding: '0 0.15rem',
    userSelect: 'none',
    touchAction: 'none'
};

const inputStyle = {
    flex: 1,
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    color: '#eef5fa',
    font: 'inherit',
    outline: 'none'
};

const todoTextStyle = {textDecoration: 'line-through', opacity: 0.55};

const dropLineStyle = {
    height: '2px',
    margin: '0.1rem 0',
    borderRadius: '2px',
    background: ACCENT_FROM
};

const statusStyle = {
    padding: '0.45rem 0.7rem',
    borderTop: '1px solid rgba(143, 205, 214, 0.2)',
    color: '#d2e1e7',
    fontSize: '0.76rem'
};

const chipStyle = {
    display: 'inline-block',
    padding: '0 0.35rem',
    borderRadius: '0.3rem',
    background: 'rgba(62, 91, 106, 0.82)'
};

const TAB_TOP_KEY = 'hiwarp:todo-tab-top';
const TAB_HEIGHT = 40;

const TodoSidebar = ({vm}) => {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState(() => readFromRuntime(vm));
    const [dragging, setDragging] = useState(null);
    const [dropAt, setDropAt] = useState(null);
    const [tabTop, setTabTop] = useState(() => {
        // 选项卡的纵向位置也持久化，免得每次都要重新拖
        try {
            const stored = Number(localStorage.getItem(TAB_TOP_KEY));
            return Number.isFinite(stored) && stored > 0 ? stored : 0;
        } catch (e) {
            return 0;
        }
    });

    const longPressTimer = useRef(null);
    // 拖动状态放 ref 里：pointermove 里要读最新值，用 state 会拿到闭包里的旧值
    const dragRef = useRef(null);
    const tabDragRef = useRef(null);

    // 项目切换后要把待办重新读进来。VM 的加载入口有好几个（启动时打开、
    // 菜单打开、拖入文件），所以这里包一层 loadProject，而不是只处理某一个。
    useEffect(() => {
        if (!vm) return undefined;
        setState(readFromRuntime(vm));
        const original = vm.loadProject;
        vm.loadProject = function (...args) {
            const result = original.apply(this, args);
            Promise.resolve(result)
                .then(() => setState(readFromRuntime(vm)))
                .catch(() => {});
            return result;
        };
        return () => {
            vm.loadProject = original;
        };
    }, [vm]);

    const commit = useCallback(next => {
        setState(next);
        writeToRuntime(vm, next);
    }, [vm]);

    const stats = useMemo(() => countItems(state), [state]);

    const clearLongPress = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    // ── 待办/分类的拖动 ──────────────────────────────────────────
    //
    // 为什么不用原生 HTML5 拖放：浏览器要求 draggable 在 pointerdown 那一刻
    // 就已经是 true，而「长按 250ms 后才可拖」意味着它是在按下**之后**才变 true 的，
    // 原生 dragstart 永远不会触发。所以这里用指针事件自己实现。
    const computeDropAt = useCallback((clientX, clientY) => {
        const element = document.elementFromPoint(clientX, clientY);
        const row = element && element.closest ? element.closest('[data-todo-row]') : null;
        if (!row) {
            // 落在面板空白处 -> 拖到根层末尾
            return {parent: null, index: Number.MAX_SAFE_INTEGER, lineFor: null, position: 'after'};
        }
        const item = state.items.find(candidate => candidate.id === row.getAttribute('data-todo-id'));
        if (!item) return null;

        const rect = row.getBoundingClientRect();
        const ratio = (clientY - rect.top) / Math.max(1, rect.height);
        const siblings = childrenOf(state, item.parent);
        const index = siblings.findIndex(sibling => sibling.id === item.id);

        if (ratio < 0.25) {
            return {parent: item.parent, index, lineFor: item.id, position: 'before'};
        }
        if (ratio > 0.75) {
            return {parent: item.parent, index: index + 1, lineFor: item.id, position: 'after'};
        }
        if (item.type === 'category') {
            return {parent: item.id, index: Number.MAX_SAFE_INTEGER, lineFor: item.id, position: 'inside'};
        }
        return {parent: item.parent, index: index + 1, lineFor: item.id, position: 'after'};
    }, [state]);

    const handleHandlePointerDown = useCallback((event, item) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const pointerId = event.pointerId;
        const target = event.currentTarget;
        clearLongPress();
        longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null;
            dragRef.current = {id: item.id, pointerId};
            setDragging(item.id);
            try {
                target.setPointerCapture(pointerId);
            } catch (e) {
                // 忽略：拿不到指针捕获时拖动仍可用，只是移出元素后会断
            }
        }, LONG_PRESS_MS);
    }, [clearLongPress]);

    const handleHandlePointerMove = useCallback(event => {
        if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
        event.preventDefault();
        setDropAt(computeDropAt(event.clientX, event.clientY));
    }, [computeDropAt]);

    const finishDrag = useCallback((event, cancelled) => {
        clearLongPress();
        const drag = dragRef.current;
        dragRef.current = null;
        setDragging(null);
        if (drag && !cancelled && dropAt) {
            commit(moveItem(state, drag.id, dropAt.parent, dropAt.index));
        }
        setDropAt(null);
        if (event && event.currentTarget && event.pointerId !== undefined) {
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch (e) {
                // 忽略
            }
        }
    }, [clearLongPress, commit, dropAt, state]);

    // ── 选项卡自身的拖动（沿左边缘上下移动，位置持久化）──────
    const handleTabPointerDown = useCallback(event => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        tabDragRef.current = {
            pointerId: event.pointerId,
            offsetY: event.clientY - tabTop,
            startY: event.clientY,
            moved: false
        };
    }, [tabTop]);

    const handleTabPointerMove = useCallback(event => {
        const drag = tabDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (Math.abs(event.clientY - drag.startY) > 4) drag.moved = true;
        // 边界钳制与 AI 侧栏的 startTabDrag 保持一致：24 ~ 视口高 - 120
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
        const max = Math.max(24, viewportHeight - 120);
        setTabTop(Math.max(24, Math.min(max, event.clientY - drag.offsetY)));
    }, []);

    const handleTabPointerUp = useCallback(event => {
        const drag = tabDragRef.current;
        tabDragRef.current = null;
        if (!drag) return;
        try {
            event.currentTarget.releasePointerCapture(event.pointerId);
        } catch (e) {
            // 忽略
        }
        if (drag.moved) {
            // 拖过就不是点击，只保存位置
            setTabTop(current => {
                try {
                    localStorage.setItem(TAB_TOP_KEY, String(Math.round(current)));
                } catch (e) {
                    // 忽略：存不下也不影响本次会话
                }
                return current;
            });
        } else {
            setOpen(true);
        }
    }, []);
    const renderRow = (item, depth) => {
        const isCategory = item.type === 'category';
        const line = dropAt && dropAt.lineFor === item.id ? dropAt : null;

        return (
            <div key={item.id}>
                {line && line.position === 'before' ? <div style={dropLineStyle} /> : null}
                <div
                    style={{
                        ...rowStyle,
                        marginLeft: `${depth * 0.9}rem`,
                        opacity: dragging === item.id ? 0.4 : 1,
                        outline: line && line.position === 'inside' ? `1px solid ${ACCENT_FROM}` : 'none'
                    }}
                    data-todo-row="1"
                    data-todo-id={item.id}

                >
                    <span
                        style={{
                            ...handleStyle,
                            cursor: dragging === item.id ? 'grabbing' : 'grab',
                            color: dragging === item.id ? ACCENT_FROM : 'rgba(210, 225, 231, 0.55)'
                        }}
                        title="长按可拖动"
                        onPointerDown={event => handleHandlePointerDown(event, item)}
                        onPointerMove={handleHandlePointerMove}
                        onPointerUp={event => finishDrag(event, false)}
                        onPointerCancel={event => finishDrag(event, true)}
                        onLostPointerCapture={() => finishDrag(null, false)}
                    >
                        ⠿
                    </span>

                    {isCategory ? (
                        <button
                            type="button"
                            style={{...buttonStyle, padding: '0 0.3rem'}}
                            title={item.collapsed ? '展开' : '收起'}
                            onClick={() => commit(updateItem(state, item.id, {collapsed: !item.collapsed}))}
                        >
                            {item.collapsed ? '▸' : '▾'}
                        </button>
                    ) : (
                        <input
                            type="checkbox"
                            checked={item.done}
                            title={item.done ? '标记为未完成' : '标记为已完成'}
                            onChange={() => commit(updateItem(state, item.id, {done: !item.done}))}
                        />
                    )}

                    <input
                        style={{...inputStyle, ...(item.done ? todoTextStyle : null)}}
                        value={item.text}
                        placeholder={isCategory ? '分类名称' : '待办内容'}
                        onChange={event => commit(updateItem(state, item.id, {text: event.target.value}))}
                    />

                    {isCategory ? (
                        <button
                            type="button"
                            style={{...buttonStyle, padding: '0 0.35rem'}}
                            title="在此分类内新建待办"
                            onClick={() => commit(addTodo(state, item.id))}
                        >
                            +
                        </button>
                    ) : null}

                    <button
                        type="button"
                        style={{...buttonStyle, padding: '0 0.35rem'}}
                        title="删除"
                        onClick={() => commit(removeItem(state, item.id))}
                    >
                        ✕
                    </button>
                </div>

                {isCategory && !item.collapsed ? childrenOf(state, item.id).map(child => renderRow(child, depth + 1)) : null}
                {line && line.position === 'after' ? <div style={dropLineStyle} /> : null}
            </div>
        );
    };

    if (!open) {
        // 收起状态改用公共的 DockableTab：竖直拖移动、水平拖出收进浮动栏。
        // 旧的本地实现（tabStyle / handleTabPointer* ）已由它取代，保留在文件上方
        // 仅因为删除需要连带清理多处引用，等功能稳定后再统一清理。
        return (
            <DockableTab
                tabKey="todo"
                label={`待办${stats.todo ? ` (${stats.done}/${stats.todo})` : ''}`}
                side="left"
                onOpen={() => setOpen(true)}
            />
        );
    }

    return (
        <div style={panelStyle}>
            <div style={headerStyle}>
                <strong>待办</strong>
                <div style={{display: 'flex', gap: '0.35rem'}}>
                    <button
                        type="button"
                        style={primaryButtonStyle}
                        onClick={() => commit(addTodo(state, null))}
                    >
                        添加待办
                    </button>
                    <button
                        type="button"
                        style={buttonStyle}
                        onClick={() => commit(addCategory(state, null))}
                    >
                        添加分类
                    </button>
                    <button type="button" style={buttonStyle} onClick={() => setOpen(false)}>
                        收起
                    </button>
                </div>
            </div>

            <div style={listStyle}>
                {state.items.length ? (
                    childrenOf(state, null).map(item => renderRow(item, 0))
                ) : (
                    <div style={{opacity: 0.6, padding: '0.6rem'}}>
                        还没有待办。点「添加待办」开始。
                    </div>
                )}
            </div>

            <div style={statusStyle}>
                待办 <span style={chipStyle}>{stats.done}/{stats.todo}</span>
                {stats.category ? <span> · 分类 <span style={chipStyle}>{stats.category}</span></span> : null}
                <span> · 随项目保存</span>
            </div>
        </div>
    );
};

TodoSidebar.propTypes = {
    vm: PropTypes.shape({
        runtime: PropTypes.object,
        loadProject: PropTypes.func
    })
};

TodoSidebar.defaultProps = {
    vm: null
};

export default TodoSidebar;