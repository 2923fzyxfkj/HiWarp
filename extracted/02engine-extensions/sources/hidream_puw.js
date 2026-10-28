// Hidream 扩展 - 仿液态玻璃弹窗
// Browser-compatible unsandboxed extension for editor and packaged projects.

(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error('「液态玻璃弹窗」扩展必须以 unsandboxed 模式加载。');
    }

    const ArgumentType = Scratch.ArgumentType;
    const BlockType = Scratch.BlockType;

const state = {
    popupElement: null,
    popupResult: '',
    popupResolve: null,
    animationDuration: 300,
    style: {
        opacity: 0.8,
        borderRadius: 20,
        blur: 20
    },
    isCreating: false,
    compilerPatched: false
};

function ensureCompilerCompatibility() {
    if (state.compilerPatched) return;
    state.compilerPatched = true;
    try {
        if (typeof window !== 'undefined' && window.__scratchRuntime && window.__scratchRuntime.compilerOptions) {
            const opts = window.__scratchRuntime.compilerOptions;
            if (opts.enabled) {
                window.__scratchRuntime.setCompilerOptions({ enabled: false });
                console.warn('[液态玻璃弹窗] 已自动关闭 TurboWarp 编译器');
            }
        }
    } catch (error) {
        console.warn('[液态玻璃弹窗] 关闭 TurboWarp 编译器失败：', error);
    }
}

function getPopupCSS() {
    const glassOpacity = Math.max(0.32, Math.min(state.style.opacity, 0.88));
    const panelRadius = Math.max(28, state.style.borderRadius + 10);
    const blurAmount = Math.max(12, state.style.blur);
    return `
        .liquid-glass-popup {
            position: fixed;
            top: 50%;
            left: 50%;
            --pointer-x: 50%;
            --pointer-y: 14%;
            --glow-x: 50%;
            --glow-y: 50%;
            --glass-shadow: rgba(15, 23, 42, 0.18);
            transform: translate(-50%, calc(-50% + 18px)) scale(0.94);
            background:
                linear-gradient(180deg, rgba(255, 255, 255, ${Math.min(glassOpacity + 0.22, 0.94)}) 0%, rgba(255, 255, 255, ${glassOpacity + 0.06}) 22%, rgba(232, 241, 255, ${Math.max(glassOpacity - 0.08, 0.22)}) 100%),
                radial-gradient(circle at 12% 10%, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0) 38%),
                radial-gradient(circle at 84% 82%, rgba(132, 186, 255, 0.18) 0%, rgba(132, 186, 255, 0) 26%);
            backdrop-filter: blur(${blurAmount * 1.75}px) saturate(185%) brightness(1.08) contrast(1.06);
            -webkit-backdrop-filter: blur(${blurAmount * 1.75}px) saturate(185%) brightness(1.08) contrast(1.06);
            border: 1px solid rgba(255, 255, 255, 0.36);
            border-radius: ${panelRadius}px;
            padding: 24px 24px 0;
            box-shadow:
                0 24px 60px var(--glass-shadow),
                0 8px 24px rgba(15, 23, 42, 0.08),
                inset 0 1px 0 rgba(255, 255, 255, 0.92),
                inset 0 -1px 0 rgba(255, 255, 255, 0.14);
            z-index: 9999;
            opacity: 0;
            transition:
                transform ${state.animationDuration}ms cubic-bezier(0.22, 1, 0.36, 1),
                opacity ${state.animationDuration}ms ease,
                box-shadow ${state.animationDuration}ms ease,
                border-color ${state.animationDuration}ms ease;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-width: 320px;
            width: min(360px, calc(100vw - 28px));
            max-width: calc(100vw - 28px);
            text-align: center;
            overflow: hidden;
            isolation: isolate;
        }
        .popup-liquid {
            position: absolute;
            inset: -16% -10%;
            pointer-events: none;
            z-index: 0;
            opacity: 0.95;
            background:
                radial-gradient(circle at var(--pointer-x) var(--pointer-y), rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.34) 10%, rgba(255, 255, 255, 0.08) 18%, rgba(255, 255, 255, 0) 34%),
                radial-gradient(circle at 16% 22%, rgba(169, 219, 255, 0.26) 0%, rgba(169, 219, 255, 0) 26%),
                radial-gradient(circle at 82% 78%, rgba(125, 180, 255, 0.18) 0%, rgba(125, 180, 255, 0) 24%);
            filter: blur(16px) saturate(130%);
        }
        .liquid-glass-popup::before {
            content: "";
            position: absolute;
            inset: 1px;
            border-radius: ${Math.max(panelRadius - 1, 15)}px;
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.68) 0%, rgba(255, 255, 255, 0.14) 20%, rgba(255, 255, 255, 0.04) 44%, rgba(255, 255, 255, 0.1) 100%),
                radial-gradient(circle at var(--pointer-x) calc(var(--pointer-y) - 2%), rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.14) 16%, rgba(255, 255, 255, 0) 42%);
            opacity: 0.96;
            pointer-events: none;
            z-index: 0;
        }
        .liquid-glass-popup::after {
            content: "";
            position: absolute;
            inset: -24% -18% auto;
            height: 64%;
            background:
                radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.12) 34%, rgba(255, 255, 255, 0) 64%),
                linear-gradient(180deg, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.08) 58%, rgba(255, 255, 255, 0) 100%);
            transform: rotate(-7deg);
            filter: blur(12px);
            opacity: 0.62;
            pointer-events: none;
            z-index: 0;
        }
        .liquid-glass-popup > * {
            position: relative;
            z-index: 1;
        }
        .liquid-glass-popup.show {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        .liquid-glass-popup.hide {
            opacity: 0;
            transform: translate(-50%, calc(-50% + 14px)) scale(0.985);
        }
        .popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background:
                radial-gradient(circle at top, rgba(186, 224, 255, 0.16) 0%, rgba(186, 224, 255, 0) 45%),
                rgba(9, 14, 24, 0.16);
            backdrop-filter: blur(${Math.max(4, blurAmount * 0.35)}px) saturate(130%);
            -webkit-backdrop-filter: blur(${Math.max(4, blurAmount * 0.35)}px) saturate(130%);
            z-index: 9998;
            opacity: 0;
            transition: opacity ${state.animationDuration}ms ease;
            pointer-events: none;
        }
        .popup-overlay.show {
            opacity: 1;
            pointer-events: all;
        }
        .popup-title {
            font-size: 19px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #0f172a;
            margin: 0 0 8px 0;
            text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
        }
        .popup-content {
            font-size: 14px;
            color: rgba(15, 23, 42, 0.72);
            margin: 0 4px 22px;
            line-height: 1.5;
        }
        .popup-buttons {
            display: flex;
            gap: 0;
            justify-content: stretch;
            flex-wrap: nowrap;
            position: relative;
            width: calc(100% + 48px);
            margin: 0 -24px;
            min-height: 54px;
            border-top: 1px solid rgba(255, 255, 255, 0.34);
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.18) 100%);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24);
        }
        .popup-button {
            position: relative;
            flex: 1 1 0;
            min-height: 54px;
            padding: 0 16px;
            border: none;
            background: transparent;
            color: rgba(15, 23, 42, 0.9);
            font-size: 17px;
            font-weight: 600;
            cursor: pointer;
            transition: color 0.2s ease, background 0.2s ease;
            -webkit-tap-highlight-color: transparent;
            overflow: hidden;
        }
        .popup-button::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
                radial-gradient(circle at var(--glow-x) var(--glow-y), rgba(255, 255, 255, 0.74) 0%, rgba(255, 255, 255, 0.24) 20%, rgba(255, 255, 255, 0) 46%),
                linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.04) 100%);
            opacity: 0;
            transition: opacity 0.22s ease;
            pointer-events: none;
        }
        .popup-button + .popup-button {
            border-left: 1px solid rgba(255, 255, 255, 0.28);
        }
        .popup-button.primary {
            color: #007aff;
        }
        .popup-button.secondary {
            color: rgba(15, 23, 42, 0.9);
        }
        .popup-button:hover {
            background: rgba(255, 255, 255, 0.08);
        }
        .popup-button:active {
            background: rgba(255, 255, 255, 0.14);
        }
        .popup-button:hover::before,
        .popup-button:focus-visible::before,
        .popup-button.energized::before {
            opacity: 1;
        }
        .popup-button.energized::before {
            animation: popup-energize 520ms ease;
        }
        .popup-button:focus-visible {
            outline: none;
            background: rgba(255, 255, 255, 0.12);
        }
        .popup-input {
            width: 100%;
            box-sizing: border-box;
            padding: 13px 16px;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.36);
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.52) 0%, rgba(240, 246, 255, 0.24) 100%);
            backdrop-filter: blur(${Math.max(12, blurAmount * 0.9)}px) saturate(160%);
            -webkit-backdrop-filter: blur(${Math.max(12, blurAmount * 0.9)}px) saturate(160%);
            margin: 2px 0 22px 0;
            font-size: 16px;
            outline: none;
            transition:
                border-color 0.2s ease,
                box-shadow 0.2s ease,
                background 0.2s ease;
            color: #0f172a;
            box-shadow:
                inset 0 1px 0 rgba(255, 255, 255, 0.74),
                inset 0 -1px 0 rgba(255, 255, 255, 0.08),
                0 4px 14px rgba(15, 23, 42, 0.06);
        }
        .popup-input:focus {
            border-color: rgba(0, 122, 255, 0.52);
            box-shadow:
                inset 0 1px 0 rgba(255, 255, 255, 0.86),
                0 0 0 4px rgba(0, 122, 255, 0.12),
                0 12px 26px rgba(0, 122, 255, 0.12);
        }
        .popup-input::placeholder {
            color: rgba(15, 23, 42, 0.4);
        }
        @media (max-width: 520px) {
            .liquid-glass-popup {
                width: min(100vw - 24px, 360px);
                min-width: 0;
                padding: 22px 22px 0;
            }
            .popup-buttons {
                width: calc(100% + 44px);
                margin: 0 -22px;
            }
            .popup-button {
                min-height: 52px;
                font-size: 17px;
            }
        }
    `;
}

function updateCSS() {
    const oldStyle = document.getElementById('liquid-glass-popup-css');
    if (oldStyle) oldStyle.remove();
    const style = document.createElement('style');
    style.id = 'liquid-glass-popup-css';
    style.textContent = getPopupCSS();
    document.head.appendChild(style);
}

function setGlassPointerPosition(element, event) {
    const rect = element.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    element.style.setProperty('--pointer-x', `${Math.max(0, Math.min(100, x))}%`);
    element.style.setProperty('--pointer-y', `${Math.max(0, Math.min(100, y))}%`);
}

function setButtonGlowPosition(button, event) {
    const rect = button.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    button.style.setProperty('--glow-x', `${Math.max(0, Math.min(100, x))}%`);
    button.style.setProperty('--glow-y', `${Math.max(0, Math.min(100, y))}%`);
}

function energizeButton(button, event) {
    if (event) setButtonGlowPosition(button, event);
    button.classList.remove('energized');
    void button.offsetWidth;
    button.classList.add('energized');
    setTimeout(() => {
        button.classList.remove('energized');
    }, 520);
}

function closePopup() {
    if (!state.popupElement) return;
    const { popup, overlay } = state.popupElement;
    popup.classList.remove('show');
    popup.classList.add('hide');
    overlay.classList.remove('show');
    state.popupResolve = null;
    setTimeout(() => {
        popup?.remove();
        overlay?.remove();
        state.popupElement = null;
        state.isCreating = false;
    }, state.animationDuration);
}

function createPopup(title, content, type = 'alert', options = {}) {
    if (state.isCreating) return Promise.resolve('');
    state.isCreating = true;
    if (state.popupElement) {
        closePopup();
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!state.popupElement) {
                    clearInterval(checkInterval);
                    createPopup(title, content, type, options).then(resolve);
                }
            }, 50);
        });
    }
    updateCSS();
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    document.body.appendChild(overlay);
    const popup = document.createElement('div');
    popup.className = 'liquid-glass-popup';
    popup.dataset.type = type;
    popup.tabIndex = -1;
    const titleEl = document.createElement('div');
    titleEl.className = 'popup-title';
    titleEl.textContent = title || '提示';
    popup.appendChild(titleEl);
    const contentEl = document.createElement('div');
    contentEl.className = 'popup-content';
    contentEl.textContent = content || '';
    popup.appendChild(contentEl);
    let inputEl = null;
    if (type === 'input') {
        inputEl = document.createElement('input');
        inputEl.className = 'popup-input';
        inputEl.type = 'text';
        inputEl.placeholder = options.placeholder || content;
        inputEl.value = options.defaultValue || '';
        popup.appendChild(inputEl);
    }
    const buttonsEl = document.createElement('div');
    buttonsEl.className = 'popup-buttons';
    popup.appendChild(buttonsEl);
    let primaryButton = null;
    let secondaryButton = null;
    if (type === 'alert') {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'popup-button primary';
        confirmBtn.textContent = options.confirmText || '确定';
        confirmBtn.onclick = () => {
            state.popupResult = confirmBtn.textContent;
            state.popupResolve?.(state.popupResult);
            closePopup();
        };
        buttonsEl.appendChild(confirmBtn);
        primaryButton = confirmBtn;
    } else if (type === 'confirm') {
        const yesBtn = document.createElement('button');
        yesBtn.className = 'popup-button primary';
        yesBtn.textContent = options.yesText || '是';
        yesBtn.onclick = () => {
            state.popupResult = true;
            state.popupResolve?.(true);
            closePopup();
        };
        const noBtn = document.createElement('button');
        noBtn.className = 'popup-button secondary';
        noBtn.textContent = options.noText || '否';
        noBtn.onclick = () => {
            state.popupResult = false;
            state.popupResolve?.(false);
            closePopup();
        };
        buttonsEl.appendChild(yesBtn);
        buttonsEl.appendChild(noBtn);
        primaryButton = yesBtn;
        secondaryButton = noBtn;
    } else if (type === 'input') {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'popup-button primary';
        confirmBtn.textContent = options.confirmText || '确定';
        confirmBtn.onclick = () => {
            state.popupResult = inputEl.value.trim();
            state.popupResolve?.(inputEl.value.trim());
            closePopup();
        };
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'popup-button secondary';
        cancelBtn.textContent = options.cancelText || '取消';
        cancelBtn.onclick = () => {
            state.popupResult = '';
            state.popupResolve?.('');
            closePopup();
        };
        buttonsEl.appendChild(confirmBtn);
        buttonsEl.appendChild(cancelBtn);
        primaryButton = confirmBtn;
        secondaryButton = cancelBtn;
    }
    popup.addEventListener('pointermove', (event) => {
        setGlassPointerPosition(popup, event);
    });
    popup.addEventListener('pointerleave', () => {
        popup.style.setProperty('--pointer-x', '50%');
        popup.style.setProperty('--pointer-y', '14%');
    });
    [primaryButton, secondaryButton].filter(Boolean).forEach((button) => {
        button.addEventListener('pointermove', (event) => {
            setButtonGlowPosition(button, event);
        });
        button.addEventListener('pointerdown', (event) => {
            energizeButton(button, event);
            setGlassPointerPosition(popup, event);
        });
    });
    popup.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && secondaryButton) {
            event.preventDefault();
            secondaryButton.click();
        } else if (event.key === 'Enter' && type === 'input' && primaryButton) {
            event.preventDefault();
            primaryButton.click();
        }
    });
    document.body.appendChild(popup);
    state.popupElement = { popup, overlay };
    setTimeout(() => {
        overlay.classList.add('show');
        popup.classList.add('show');
        (inputEl || primaryButton || popup).focus?.();
    }, 10);
    return new Promise((resolve) => {
        state.popupResolve = resolve;
    });
}

function buildNativeDialogText(title, content) {
    const safeTitle = String(title || '').trim();
    const safeContent = String(content || '').trim();
    if (safeTitle && safeContent) {
        return `${safeTitle}\n\n${safeContent}`;
    }
    return safeTitle || safeContent || '提示';
}

class LiquidGlassPopup {
    constructor (runtime) {
        // runtime is provided by builtin extension loader
        this.runtime = runtime;
        // Store runtime reference for compiler compatibility check
        if (typeof window !== 'undefined') {
            window.__scratchRuntime = runtime;
        }
        ensureCompilerCompatibility();
        updateCSS();
    }

    getInfo () {
        return {
            id: 'liquidGlassPopup',
            name: '液态玻璃弹窗',
            color1: '#0071e3',
            color2: '#0077ed',
            blocks: [
                {
                    opcode: 'showAlertPopup',
                    blockType: BlockType.COMMAND,
                    text: '显示液态玻璃提示弹窗并等待 标题：[TITLE] 内容：[CONTENT] 按钮文字：[BTN_TEXT]',
                    arguments: {
                        TITLE: { type: ArgumentType.STRING, defaultValue: '提示' },
                        CONTENT: { type: ArgumentType.STRING, defaultValue: '这是液态玻璃弹窗' },
                        BTN_TEXT: { type: ArgumentType.STRING, defaultValue: '确定' }
                    }
                },
                '---稳定输出型积木（可嵌套到任意参数）',
                {
                    opcode: 'showConfirmPopup',
                    blockType: BlockType.BOOLEAN,
                    text: '稳定问答输出 标题：[TITLE] 问题：[QUESTION] 是：[YES] 否：[NO]',
                    arguments: {
                        TITLE: { type: ArgumentType.STRING, defaultValue: '提问' },
                        QUESTION: { type: ArgumentType.STRING, defaultValue: '你确定吗？' },
                        YES: { type: ArgumentType.STRING, defaultValue: '是' },
                        NO: { type: ArgumentType.STRING, defaultValue: '否' }
                    }
                },
                {
                    opcode: 'showInputPopup',
                    blockType: BlockType.REPORTER,
                    text: '稳定输入输出 标题：[TITLE] 提示：[PROMPT] 默认值：[DEFAULT] 确定：[CONFIRM] 取消：[CANCEL]',
                    arguments: {
                        TITLE: { type: ArgumentType.STRING, defaultValue: '输入' },
                        PROMPT: { type: ArgumentType.STRING, defaultValue: '请输入内容：' },
                        DEFAULT: { type: ArgumentType.STRING, defaultValue: '' },
                        CONFIRM: { type: ArgumentType.STRING, defaultValue: '确定' },
                        CANCEL: { type: ArgumentType.STRING, defaultValue: '取消' }
                    }
                },
                '---液态玻璃外观型积木（不能嵌套到参数）',
                {
                    opcode: 'showStyledConfirmPopup',
                    blockType: BlockType.COMMAND,
                    text: '显示液态玻璃问答弹窗并等待 标题：[TITLE] 问题：[QUESTION] 是：[YES] 否：[NO]',
                    arguments: {
                        TITLE: { type: ArgumentType.STRING, defaultValue: '提问' },
                        QUESTION: { type: ArgumentType.STRING, defaultValue: '你确定吗？' },
                        YES: { type: ArgumentType.STRING, defaultValue: '是' },
                        NO: { type: ArgumentType.STRING, defaultValue: '否' }
                    }
                },
                {
                    opcode: 'showStyledInputPopup',
                    blockType: BlockType.COMMAND,
                    text: '显示液态玻璃输入弹窗并等待 标题：[TITLE] 提示：[PROMPT] 默认值：[DEFAULT] 确定：[CONFIRM] 取消：[CANCEL]',
                    arguments: {
                        TITLE: { type: ArgumentType.STRING, defaultValue: '输入' },
                        PROMPT: { type: ArgumentType.STRING, defaultValue: '请输入内容：' },
                        DEFAULT: { type: ArgumentType.STRING, defaultValue: '' },
                        CONFIRM: { type: ArgumentType.STRING, defaultValue: '确定' },
                        CANCEL: { type: ArgumentType.STRING, defaultValue: '取消' }
                    }
                },
                {
                    opcode: 'setPopupStyle',
                    blockType: BlockType.COMMAND,
                    text: '设置弹窗样式 透明度：[OPACITY] 圆角：[RADIUS]px 模糊度：[BLUR]px 动画时长：[DURATION]ms',
                    arguments: {
                        OPACITY: { type: ArgumentType.NUMBER, defaultValue: 0.8, min: 0.1, max: 1 },
                        RADIUS: { type: ArgumentType.NUMBER, defaultValue: 20, min: 0, max: 50 },
                        BLUR: { type: ArgumentType.NUMBER, defaultValue: 20, min: 0, max: 50 },
                        DURATION: { type: ArgumentType.NUMBER, defaultValue: 300, min: 100, max: 2000 }
                    }
                },
                {
                    opcode: 'closePopup',
                    blockType: BlockType.COMMAND,
                    text: '关闭当前弹窗'
                },
                {
                    opcode: 'getPopupResult',
                    blockType: BlockType.REPORTER,
                    text: '获取最后一次弹窗结果'
                }
            ]
        };
    }

    showAlertPopup(args, util) {
        // Use the same pattern as the original for yielding
        const frame = util && util.stackFrame ? util.stackFrame : null;
        if (!frame) {
            return createPopup(args.TITLE, args.CONTENT, 'alert', { confirmText: args.BTN_TEXT });
        }
        if (!frame.popupCommandRequest) {
            const request = { done: false };
            frame.popupCommandRequest = request;
            Promise.resolve(createPopup(args.TITLE, args.CONTENT, 'alert', { confirmText: args.BTN_TEXT })).finally(() => {
                request.done = true;
            });
        }
        if (!frame.popupCommandRequest.done) {
            util.yield();
            return;
        }
        delete frame.popupCommandRequest;
    }

    showConfirmPopup(args) {
        const text = [args.TITLE, args.QUESTION].filter(Boolean).join('\n\n') || '提问';
        const result = window.confirm(text);
        state.popupResult = result;
        return result;
    }

    showInputPopup(args) {
        const text = [args.TITLE, args.PROMPT].filter(Boolean).join('\n\n') || '输入';
        const result = window.prompt(text, String(args.DEFAULT || ''));
        const finalValue = result === null ? '' : String(result);
        state.popupResult = finalValue;
        return finalValue;
    }

    showStyledConfirmPopup(args, util) {
        const frame = util && util.stackFrame ? util.stackFrame : null;
        if (!frame) {
            return createPopup(args.TITLE, args.QUESTION, 'confirm', { yesText: args.YES, noText: args.NO });
        }
        if (!frame.popupCommandRequest) {
            const request = { done: false };
            frame.popupCommandRequest = request;
            Promise.resolve(createPopup(args.TITLE, args.QUESTION, 'confirm', { yesText: args.YES, noText: args.NO })).finally(() => {
                request.done = true;
            });
        }
        if (!frame.popupCommandRequest.done) {
            util.yield();
            return;
        }
        delete frame.popupCommandRequest;
    }

    showStyledInputPopup(args, util) {
        const frame = util && util.stackFrame ? util.stackFrame : null;
        if (!frame) {
            return createPopup(args.TITLE, args.PROMPT, 'input', {
                defaultValue: args.DEFAULT,
                confirmText: args.CONFIRM,
                cancelText: args.CANCEL
            });
        }
        if (!frame.popupCommandRequest) {
            const request = { done: false };
            frame.popupCommandRequest = request;
            Promise.resolve(createPopup(args.TITLE, args.PROMPT, 'input', {
                defaultValue: args.DEFAULT,
                confirmText: args.CONFIRM,
                cancelText: args.CANCEL
            })).finally(() => {
                request.done = true;
            });
        }
        if (!frame.popupCommandRequest.done) {
            util.yield();
            return;
        }
        delete frame.popupCommandRequest;
    }

    setPopupStyle(args) {
        state.animationDuration = args.DURATION;
        state.style.opacity = args.OPACITY;
        state.style.borderRadius = args.RADIUS;
        state.style.blur = args.BLUR;
        updateCSS();
    }

    closePopup() {
        closePopup();
    }

    getPopupResult() {
        return state.popupResult !== undefined ? state.popupResult : '';
    }
}

Scratch.extensions.register(new LiquidGlassPopup(Scratch.vm && Scratch.vm.runtime));
})(Scratch);
