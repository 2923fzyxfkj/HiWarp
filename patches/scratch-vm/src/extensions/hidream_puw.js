// Hidream 扩展 - 仿液态玻璃弹窗
// Wrapper for builtin extension loading - passes the runtime
// The original extension logic is adapted to work without the Scratch global

const ArgumentType = require('../extension-support/argument-type');
const BlockType = require('../extension-support/block-type');
const Cast = require('../util/cast');
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
        window.__scratchRuntime.setCompilerOptions({
          enabled: false
        });
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
  return "\n        .liquid-glass-popup {\n            position: fixed;\n            top: 50%;\n            left: 50%;\n            --pointer-x: 50%;\n            --pointer-y: 14%;\n            --glow-x: 50%;\n            --glow-y: 50%;\n            --glass-shadow: rgba(15, 23, 42, 0.18);\n            transform: translate(-50%, calc(-50% + 18px)) scale(0.94);\n            background:\n                linear-gradient(180deg, rgba(255, 255, 255, ".concat(Math.min(glassOpacity + 0.22, 0.94), ") 0%, rgba(255, 255, 255, ").concat(glassOpacity + 0.06, ") 22%, rgba(232, 241, 255, ").concat(Math.max(glassOpacity - 0.08, 0.22), ") 100%),\n                radial-gradient(circle at 12% 10%, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0) 38%),\n                radial-gradient(circle at 84% 82%, rgba(132, 186, 255, 0.18) 0%, rgba(132, 186, 255, 0) 26%);\n            backdrop-filter: blur(").concat(blurAmount * 1.75, "px) saturate(185%) brightness(1.08) contrast(1.06);\n            -webkit-backdrop-filter: blur(").concat(blurAmount * 1.75, "px) saturate(185%) brightness(1.08) contrast(1.06);\n            border: 1px solid rgba(255, 255, 255, 0.36);\n            border-radius: ").concat(panelRadius, "px;\n            padding: 24px 24px 0;\n            box-shadow:\n                0 24px 60px var(--glass-shadow),\n                0 8px 24px rgba(15, 23, 42, 0.08),\n                inset 0 1px 0 rgba(255, 255, 255, 0.92),\n                inset 0 -1px 0 rgba(255, 255, 255, 0.14);\n            z-index: 9999;\n            opacity: 0;\n            transition:\n                transform ").concat(state.animationDuration, "ms cubic-bezier(0.22, 1, 0.36, 1),\n                opacity ").concat(state.animationDuration, "ms ease,\n                box-shadow ").concat(state.animationDuration, "ms ease,\n                border-color ").concat(state.animationDuration, "ms ease;\n            font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n            min-width: 320px;\n            width: min(360px, calc(100vw - 28px));\n            max-width: calc(100vw - 28px);\n            text-align: center;\n            overflow: hidden;\n            isolation: isolate;\n        }\n        .popup-liquid {\n            position: absolute;\n            inset: -16% -10%;\n            pointer-events: none;\n            z-index: 0;\n            opacity: 0.95;\n            background:\n                radial-gradient(circle at var(--pointer-x) var(--pointer-y), rgba(255, 255, 255, 0.78) 0%, rgba(255, 255, 255, 0.34) 10%, rgba(255, 255, 255, 0.08) 18%, rgba(255, 255, 255, 0) 34%),\n                radial-gradient(circle at 16% 22%, rgba(169, 219, 255, 0.26) 0%, rgba(169, 219, 255, 0) 26%),\n                radial-gradient(circle at 82% 78%, rgba(125, 180, 255, 0.18) 0%, rgba(125, 180, 255, 0) 24%);\n            filter: blur(16px) saturate(130%);\n        }\n        .liquid-glass-popup::before {\n            content: \"\";\n            position: absolute;\n            inset: 1px;\n            border-radius: ").concat(Math.max(panelRadius - 1, 15), "px;\n            background:\n                linear-gradient(180deg, rgba(255, 255, 255, 0.68) 0%, rgba(255, 255, 255, 0.14) 20%, rgba(255, 255, 255, 0.04) 44%, rgba(255, 255, 255, 0.1) 100%),\n                radial-gradient(circle at var(--pointer-x) calc(var(--pointer-y) - 2%), rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.14) 16%, rgba(255, 255, 255, 0) 42%);\n            opacity: 0.96;\n            pointer-events: none;\n            z-index: 0;\n        }\n        .liquid-glass-popup::after {\n            content: \"\";\n            position: absolute;\n            inset: -24% -18% auto;\n            height: 64%;\n            background:\n                radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.12) 34%, rgba(255, 255, 255, 0) 64%),\n                linear-gradient(180deg, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.08) 58%, rgba(255, 255, 255, 0) 100%);\n            transform: rotate(-7deg);\n            filter: blur(12px);\n            opacity: 0.62;\n            pointer-events: none;\n            z-index: 0;\n        }\n        .liquid-glass-popup > * {\n            position: relative;\n            z-index: 1;\n        }\n        .liquid-glass-popup.show {\n            opacity: 1;\n            transform: translate(-50%, -50%) scale(1);\n        }\n        .liquid-glass-popup.hide {\n            opacity: 0;\n            transform: translate(-50%, calc(-50% + 14px)) scale(0.985);\n        }\n        .popup-overlay {\n            position: fixed;\n            top: 0;\n            left: 0;\n            width: 100%;\n            height: 100%;\n            background:\n                radial-gradient(circle at top, rgba(186, 224, 255, 0.16) 0%, rgba(186, 224, 255, 0) 45%),\n                rgba(9, 14, 24, 0.16);\n            backdrop-filter: blur(").concat(Math.max(4, blurAmount * 0.35), "px) saturate(130%);\n            -webkit-backdrop-filter: blur(").concat(Math.max(4, blurAmount * 0.35), "px) saturate(130%);\n            z-index: 9998;\n            opacity: 0;\n            transition: opacity ").concat(state.animationDuration, "ms ease;\n            pointer-events: none;\n        }\n        .popup-overlay.show {\n            opacity: 1;\n            pointer-events: all;\n        }\n        .popup-title {\n            font-size: 19px;\n            font-weight: 700;\n            letter-spacing: -0.02em;\n            color: #0f172a;\n            margin: 0 0 8px 0;\n            text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);\n        }\n        .popup-content {\n            font-size: 14px;\n            color: rgba(15, 23, 42, 0.72);\n            margin: 0 4px 22px;\n            line-height: 1.5;\n        }\n        .popup-buttons {\n            display: flex;\n            gap: 0;\n            justify-content: stretch;\n            flex-wrap: nowrap;\n            position: relative;\n            width: calc(100% + 48px);\n            margin: 0 -24px;\n            min-height: 54px;\n            border-top: 1px solid rgba(255, 255, 255, 0.34);\n            background:\n                linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.18) 100%);\n            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24);\n        }\n        .popup-button {\n            position: relative;\n            flex: 1 1 0;\n            min-height: 54px;\n            padding: 0 16px;\n            border: none;\n            background: transparent;\n            color: rgba(15, 23, 42, 0.9);\n            font-size: 17px;\n            font-weight: 600;\n            cursor: pointer;\n            transition: color 0.2s ease, background 0.2s ease;\n            -webkit-tap-highlight-color: transparent;\n            overflow: hidden;\n        }\n        .popup-button::before {\n            content: \"\";\n            position: absolute;\n            inset: 0;\n            background:\n                radial-gradient(circle at var(--glow-x) var(--glow-y), rgba(255, 255, 255, 0.74) 0%, rgba(255, 255, 255, 0.24) 20%, rgba(255, 255, 255, 0) 46%),\n                linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.04) 100%);\n            opacity: 0;\n            transition: opacity 0.22s ease;\n            pointer-events: none;\n        }\n        .popup-button + .popup-button {\n            border-left: 1px solid rgba(255, 255, 255, 0.28);\n        }\n        .popup-button.primary {\n            color: #007aff;\n        }\n        .popup-button.secondary {\n            color: rgba(15, 23, 42, 0.9);\n        }\n        .popup-button:hover {\n            background: rgba(255, 255, 255, 0.08);\n        }\n        .popup-button:active {\n            background: rgba(255, 255, 255, 0.14);\n        }\n        .popup-button:hover::before,\n        .popup-button:focus-visible::before,\n        .popup-button.energized::before {\n            opacity: 1;\n        }\n        .popup-button.energized::before {\n            animation: popup-energize 520ms ease;\n        }\n        .popup-button:focus-visible {\n            outline: none;\n            background: rgba(255, 255, 255, 0.12);\n        }\n        .popup-input {\n            width: 100%;\n            box-sizing: border-box;\n            padding: 13px 16px;\n            border-radius: 16px;\n            border: 1px solid rgba(255, 255, 255, 0.36);\n            background:\n                linear-gradient(180deg, rgba(255, 255, 255, 0.52) 0%, rgba(240, 246, 255, 0.24) 100%);\n            backdrop-filter: blur(").concat(Math.max(12, blurAmount * 0.9), "px) saturate(160%);\n            -webkit-backdrop-filter: blur(").concat(Math.max(12, blurAmount * 0.9), "px) saturate(160%);\n            margin: 2px 0 22px 0;\n            font-size: 16px;\n            outline: none;\n            transition:\n                border-color 0.2s ease,\n                box-shadow 0.2s ease,\n                background 0.2s ease;\n            color: #0f172a;\n            box-shadow:\n                inset 0 1px 0 rgba(255, 255, 255, 0.74),\n                inset 0 -1px 0 rgba(255, 255, 255, 0.08),\n                0 4px 14px rgba(15, 23, 42, 0.06);\n        }\n        .popup-input:focus {\n            border-color: rgba(0, 122, 255, 0.52);\n            box-shadow:\n                inset 0 1px 0 rgba(255, 255, 255, 0.86),\n                0 0 0 4px rgba(0, 122, 255, 0.12),\n                0 12px 26px rgba(0, 122, 255, 0.12);\n        }\n        .popup-input::placeholder {\n            color: rgba(15, 23, 42, 0.4);\n        }\n        @media (max-width: 520px) {\n            .liquid-glass-popup {\n                width: min(100vw - 24px, 360px);\n                min-width: 0;\n                padding: 22px 22px 0;\n            }\n            .popup-buttons {\n                width: calc(100% + 44px);\n                margin: 0 -22px;\n            }\n            .popup-button {\n                min-height: 52px;\n                font-size: 17px;\n            }\n        }\n    ");
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
  const x = (event.clientX - rect.left) / rect.width * 100;
  const y = (event.clientY - rect.top) / rect.height * 100;
  element.style.setProperty('--pointer-x', "".concat(Math.max(0, Math.min(100, x)), "%"));
  element.style.setProperty('--pointer-y', "".concat(Math.max(0, Math.min(100, y)), "%"));
}
function setButtonGlowPosition(button, event) {
  const rect = button.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * 100;
  const y = (event.clientY - rect.top) / rect.height * 100;
  button.style.setProperty('--glow-x', "".concat(Math.max(0, Math.min(100, x)), "%"));
  button.style.setProperty('--glow-y', "".concat(Math.max(0, Math.min(100, y)), "%"));
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
  const {
    popup,
    overlay
  } = state.popupElement;
  popup.classList.remove('show');
  popup.classList.add('hide');
  overlay.classList.remove('show');
  state.popupResolve = null;
  setTimeout(() => {
    popup === null || popup === void 0 || popup.remove();
    overlay === null || overlay === void 0 || overlay.remove();
    state.popupElement = null;
    state.isCreating = false;
  }, state.animationDuration);
}
function createPopup(title, content) {
  let type = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'alert';
  let options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  if (state.isCreating) return Promise.resolve('');
  state.isCreating = true;
  if (state.popupElement) {
    closePopup();
    return new Promise(resolve => {
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
      var _state$popupResolve;
      state.popupResult = confirmBtn.textContent;
      (_state$popupResolve = state.popupResolve) === null || _state$popupResolve === void 0 || _state$popupResolve.call(state, state.popupResult);
      closePopup();
    };
    buttonsEl.appendChild(confirmBtn);
    primaryButton = confirmBtn;
  } else if (type === 'confirm') {
    const yesBtn = document.createElement('button');
    yesBtn.className = 'popup-button primary';
    yesBtn.textContent = options.yesText || '是';
    yesBtn.onclick = () => {
      var _state$popupResolve2;
      state.popupResult = true;
      (_state$popupResolve2 = state.popupResolve) === null || _state$popupResolve2 === void 0 || _state$popupResolve2.call(state, true);
      closePopup();
    };
    const noBtn = document.createElement('button');
    noBtn.className = 'popup-button secondary';
    noBtn.textContent = options.noText || '否';
    noBtn.onclick = () => {
      var _state$popupResolve3;
      state.popupResult = false;
      (_state$popupResolve3 = state.popupResolve) === null || _state$popupResolve3 === void 0 || _state$popupResolve3.call(state, false);
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
      var _state$popupResolve4;
      state.popupResult = inputEl.value.trim();
      (_state$popupResolve4 = state.popupResolve) === null || _state$popupResolve4 === void 0 || _state$popupResolve4.call(state, inputEl.value.trim());
      closePopup();
    };
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'popup-button secondary';
    cancelBtn.textContent = options.cancelText || '取消';
    cancelBtn.onclick = () => {
      var _state$popupResolve5;
      state.popupResult = '';
      (_state$popupResolve5 = state.popupResolve) === null || _state$popupResolve5 === void 0 || _state$popupResolve5.call(state, '');
      closePopup();
    };
    buttonsEl.appendChild(confirmBtn);
    buttonsEl.appendChild(cancelBtn);
    primaryButton = confirmBtn;
    secondaryButton = cancelBtn;
  }
  popup.addEventListener('pointermove', event => {
    setGlassPointerPosition(popup, event);
  });
  popup.addEventListener('pointerleave', () => {
    popup.style.setProperty('--pointer-x', '50%');
    popup.style.setProperty('--pointer-y', '14%');
  });
  [primaryButton, secondaryButton].filter(Boolean).forEach(button => {
    button.addEventListener('pointermove', event => {
      setButtonGlowPosition(button, event);
    });
    button.addEventListener('pointerdown', event => {
      energizeButton(button, event);
      setGlassPointerPosition(popup, event);
    });
  });
  popup.addEventListener('keydown', event => {
    if (event.key === 'Escape' && secondaryButton) {
      event.preventDefault();
      secondaryButton.click();
    } else if (event.key === 'Enter' && type === 'input' && primaryButton) {
      event.preventDefault();
      primaryButton.click();
    }
  });
  document.body.appendChild(popup);
  state.popupElement = {
    popup,
    overlay
  };
  setTimeout(() => {
    var _focus, _ref;
    overlay.classList.add('show');
    popup.classList.add('show');
    (_focus = (_ref = inputEl || primaryButton || popup).focus) === null || _focus === void 0 || _focus.call(_ref);
  }, 10);
  return new Promise(resolve => {
    state.popupResolve = resolve;
  });
}
function buildNativeDialogText(title, content) {
  const safeTitle = String(title || '').trim();
  const safeContent = String(content || '').trim();
  if (safeTitle && safeContent) {
    return "".concat(safeTitle, "\n\n").concat(safeContent);
  }
  return safeTitle || safeContent || '提示';
}
class LiquidGlassPopup {
  constructor(runtime) {
    // runtime is provided by builtin extension loader
    this.runtime = runtime;
    // Store runtime reference for compiler compatibility check
    if (typeof window !== 'undefined') {
      window.__scratchRuntime = runtime;
    }
    ensureCompilerCompatibility();
    updateCSS();
  }
  getInfo() {
    return {
      id: 'liquidGlassPopup',
      name: '液态玻璃弹窗',
      color1: '#0071e3',
      color2: '#0077ed',
      blocks: [{
        opcode: 'showAlertPopup',
        blockType: BlockType.COMMAND,
        text: '显示液态玻璃提示弹窗并等待 标题：[TITLE] 内容：[CONTENT] 按钮文字：[BTN_TEXT]',
        arguments: {
          TITLE: {
            type: ArgumentType.STRING,
            defaultValue: '提示'
          },
          CONTENT: {
            type: ArgumentType.STRING,
            defaultValue: '这是液态玻璃弹窗'
          },
          BTN_TEXT: {
            type: ArgumentType.STRING,
            defaultValue: '确定'
          }
        }
      }, '---稳定输出型积木（可嵌套到任意参数）', {
        opcode: 'showConfirmPopup',
        blockType: BlockType.BOOLEAN,
        text: '稳定问答输出 标题：[TITLE] 问题：[QUESTION] 是：[YES] 否：[NO]',
        arguments: {
          TITLE: {
            type: ArgumentType.STRING,
            defaultValue: '提问'
          },
          QUESTION: {
            type: ArgumentType.STRING,
            defaultValue: '你确定吗？'
          },
          YES: {
            type: ArgumentType.STRING,
            defaultValue: '是'
          },
          NO: {
            type: ArgumentType.STRING,
            defaultValue: '否'
          }
        }
      }, {
        opcode: 'showInputPopup',
        blockType: BlockType.REPORTER,
        text: '稳定输入输出 标题：[TITLE] 提示：[PROMPT] 默认值：[DEFAULT] 确定：[CONFIRM] 取消：[CANCEL]',
        arguments: {
          TITLE: {
            type: ArgumentType.STRING,
            defaultValue: '输入'
          },
          PROMPT: {
            type: ArgumentType.STRING,
            defaultValue: '请输入内容：'
          },
          DEFAULT: {
            type: ArgumentType.STRING,
            defaultValue: ''
          },
          CONFIRM: {
            type: ArgumentType.STRING,
            defaultValue: '确定'
          },
          CANCEL: {
            type: ArgumentType.STRING,
            defaultValue: '取消'
          }
        }
      }, '---液态玻璃外观型积木（不能嵌套到参数）', {
        opcode: 'showStyledConfirmPopup',
        blockType: BlockType.COMMAND,
        text: '显示液态玻璃问答弹窗并等待 标题：[TITLE] 问题：[QUESTION] 是：[YES] 否：[NO]',
        arguments: {
          TITLE: {
            type: ArgumentType.STRING,
            defaultValue: '提问'
          },
          QUESTION: {
            type: ArgumentType.STRING,
            defaultValue: '你确定吗？'
          },
          YES: {
            type: ArgumentType.STRING,
            defaultValue: '是'
          },
          NO: {
            type: ArgumentType.STRING,
            defaultValue: '否'
          }
        }
      }, {
        opcode: 'showStyledInputPopup',
        blockType: BlockType.COMMAND,
        text: '显示液态玻璃输入弹窗并等待 标题：[TITLE] 提示：[PROMPT] 默认值：[DEFAULT] 确定：[CONFIRM] 取消：[CANCEL]',
        arguments: {
          TITLE: {
            type: ArgumentType.STRING,
            defaultValue: '输入'
          },
          PROMPT: {
            type: ArgumentType.STRING,
            defaultValue: '请输入内容：'
          },
          DEFAULT: {
            type: ArgumentType.STRING,
            defaultValue: ''
          },
          CONFIRM: {
            type: ArgumentType.STRING,
            defaultValue: '确定'
          },
          CANCEL: {
            type: ArgumentType.STRING,
            defaultValue: '取消'
          }
        }
      }, {
        opcode: 'setPopupStyle',
        blockType: BlockType.COMMAND,
        text: '设置弹窗样式 透明度：[OPACITY] 圆角：[RADIUS]px 模糊度：[BLUR]px 动画时长：[DURATION]ms',
        arguments: {
          OPACITY: {
            type: ArgumentType.NUMBER,
            defaultValue: 0.8,
            min: 0.1,
            max: 1
          },
          RADIUS: {
            type: ArgumentType.NUMBER,
            defaultValue: 20,
            min: 0,
            max: 50
          },
          BLUR: {
            type: ArgumentType.NUMBER,
            defaultValue: 20,
            min: 0,
            max: 50
          },
          DURATION: {
            type: ArgumentType.NUMBER,
            defaultValue: 300,
            min: 100,
            max: 2000
          }
        }
      }, {
        opcode: 'closePopup',
        blockType: BlockType.COMMAND,
        text: '关闭当前弹窗'
      }, {
        opcode: 'getPopupResult',
        blockType: BlockType.REPORTER,
        text: '获取最后一次弹窗结果'
      }]
    };
  }
  showAlertPopup(args, util) {
    // Use the same pattern as the original for yielding
    const frame = util && util.stackFrame ? util.stackFrame : null;
    if (!frame) {
      return createPopup(args.TITLE, args.CONTENT, 'alert', {
        confirmText: args.BTN_TEXT
      });
    }
    if (!frame.popupCommandRequest) {
      const request = {
        done: false
      };
      frame.popupCommandRequest = request;
      Promise.resolve(createPopup(args.TITLE, args.CONTENT, 'alert', {
        confirmText: args.BTN_TEXT
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
      return createPopup(args.TITLE, args.QUESTION, 'confirm', {
        yesText: args.YES,
        noText: args.NO
      });
    }
    if (!frame.popupCommandRequest) {
      const request = {
        done: false
      };
      frame.popupCommandRequest = request;
      Promise.resolve(createPopup(args.TITLE, args.QUESTION, 'confirm', {
        yesText: args.YES,
        noText: args.NO
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
      const request = {
        done: false
      };
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
module.exports = LiquidGlassPopup;