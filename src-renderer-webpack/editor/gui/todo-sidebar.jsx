import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import PropTypes from 'prop-types';
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

// 配色与 AI 侧栏保持一致（深青 + 青色强调），复用同一套视觉语言。
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
    background: 'radial-gradient(circle at 18% 4%, rgba(58, 126, 132, 0.42) 0, transparent 32%), ' +
        'linear-gradient(180deg, #162a34 0%, #0c171f 100%)',
    color: '#eef5fa',
    boxShadow: '18px 0 48px rgba(3, 14, 21, 0.46)',
    borderRight: '1px solid rgba(154, 218, 222, 0.24)',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: '0.86rem'
};

const tabStyle = {
    position: 'fixed',
    top: '50%',
    left: 0,
    transform: 'translateY(-50%)',
    zIndex: 10000,
    padding: '0.7rem 0.45rem',
    border: '1px solid rgba(154, 218, 222, 0.36)',
    borderLeft: 'none',
    borderRadius: '0 0.5rem 0.5rem 0',
    background: 'linear-gradient(180deg, #162a34 0%, #0c171f 100%)',
    color: '#eef5fa',
    cursor: 'pointer',
    writingMode: 'vertical-rl',
    letterSpacing: '0.08em'
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
    background: 'linear-gradient(135deg, #1e91a4, #146f84)',
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
    background: '#1e91a4'
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

const TodoSidebar = ({vm}) => {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState(() => readFromRuntime(vm));
    const [armed, setArmed] = useState(null);
    const [dragging, setDragging] = useState(null);
    const [dropAt, setDropAt] = useState(null);
    const longPressTimer = useRef(null);

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

    const handleDragOver = useCallback((event, item) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
        const siblings = childrenOf(state, item.parent);
        const index = siblings.findIndex(sibling => sibling.id === item.id);

        // 上缘 1/4 插到前面，下缘 1/4 插到后面，中间落在分类内部
        if (ratio < 0.25) {
            setDropAt({parent: item.parent, index, lineFor: item.id, position: 'before'});
        } else if (ratio > 0.75) {
            setDropAt({parent: item.parent, index: index + 1, lineFor: item.id, position: 'after'});
        } else if (item.type === 'category') {
            setDropAt({parent: item.id, index: Number.MAX_SAFE_INTEGER, lineFor: item.id, position: 'inside'});
        } else {
            setDropAt({parent: item.parent, index: index + 1, lineFor: item.id, position: 'after'});
        }
    }, [state]);

    const handleDrop = useCallback(event => {
        event.preventDefault();
        event.stopPropagation();
        const sourceId = event.dataTransfer.getData('text/plain') || dragging;
        if (sourceId && dropAt) {
            commit(moveItem(state, sourceId, dropAt.parent, dropAt.index));
        }
        setDragging(null);
        setDropAt(null);
        setArmed(null);
    }, [commit, dragging, dropAt, state]);

    const handleDragEnd = useCallback(() => {
        clearLongPress();
        setDragging(null);
        setDropAt(null);
        setArmed(null);
    }, [clearLongPress]);

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
                        outline: line && line.position === 'inside' ? '1px solid #1e91a4' : 'none'
                    }}
                    onDragOver={event => handleDragOver(event, item)}
                    onDrop={handleDrop}
                >
                    <span
                        style={handleStyle}
                        title="长按可拖动"
                        draggable={armed === item.id}
                        onPointerDown={() => {
                            clearLongPress();
                            longPressTimer.current = setTimeout(() => setArmed(item.id), LONG_PRESS_MS);
                        }}
                        onPointerUp={clearLongPress}
                        onPointerLeave={clearLongPress}
                        onDragStart={event => {
                            setDragging(item.id);
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', item.id);
                        }}
                        onDragEnd={handleDragEnd}
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
        return (
            <button type="button" style={tabStyle} onClick={() => setOpen(true)}>
                待办 {stats.todo ? `(${stats.done}/${stats.todo})` : ''}
            </button>
        );
    }

    return (
        <div
            style={panelStyle}
            onDragOver={event => {
                // 空白处 = 拖到根层末尾
                if (event.target === event.currentTarget) {
                    event.preventDefault();
                    setDropAt({parent: null, index: Number.MAX_SAFE_INTEGER, lineFor: null, position: 'after'});
                }
            }}
            onDrop={handleDrop}
        >
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