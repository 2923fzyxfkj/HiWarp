/**
 * DeepSeek 网页版内置实现 —— 免费使用 DeepSeek 的核心。
 *
 * 原理：HiWarp 是 Electron 应用，自带 Chromium。这里直接开一个
 * 持久化的浏览器会话（partition: persist:deepseek-free）加载
 * chat.deepseek.com，用页面自己的 JS 处理登录、PoW 与流式输出，
 * 我们只做三件事（与 deepseek-notoken-api 相同的思路）：
 *   1. 检查/获取登录态（首次打开可见窗口让用户登录，登录态存本地）
 *   2. 在输入框填入消息并发送（回车，按钮兜底）
 *   3. 读取页面中最近一条助手回复（等它流式结束）
 *
 * 不需要 Python、playwright 或任何安装步骤，clone 即可用。
 */

const {BrowserWindow} = require('electron');
const {logger} = require('./logging');

const log = logger('deepseek-web');

const CHAT_URL = 'https://chat.deepseek.com/';
const LOGIN_URL = 'https://chat.deepseek.com/sign_in';
const PARTITION = 'persist:deepseek-free';

const INPUT_SELECTORS = [
  'textarea[placeholder*="发送消息"]',
  'textarea[placeholder*="Message"]',
  'textarea#chat-input'
];
const REPLY_SELECTORS = ['div.ds-markdown'];
const SEND_BUTTON_SELECTORS = ['.df-messagebox-send', 'button[type=submit]'];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class DeepSeekWeb {
  constructor () {
    this.window = null;
    this.loadedUrl = null;
  }

  ensureWindow (visible) {
    if (this.window && !this.window.isDestroyed()) {
      if (visible) this.window.show();
      return Promise.resolve(this.window);
    }
    this.window = new BrowserWindow({
      show: visible,
      width: 1100,
      height: 800,
      autoHideMenuBar: true,
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // 隐藏窗口也保持定时器运行，PoW/流式输出不会被节流拖慢
        backgroundThrottling: false
      }
    });
    this.window.on('closed', () => {
      this.window = null;
      this.loadedUrl = null;
    });
    this.window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
    this.window.webContents.on('will-navigate', (event, url) => {
      // 允许 deepseek.com 全部子域（登录流程可能跳转验证/授权页），其余外部导航一律阻止
      const allowed = /^https:\/\/([a-z0-9-]+\.)*deepseek\.com\//i.test(url);
      if (!allowed) {
        event.preventDefault();
      }
    });
    return Promise.resolve(this.window);
  }

  async goto (url) {
    await this.ensureWindow(false);
    if (this.loadedUrl !== url) {
      await this.window.loadURL(url);
      this.loadedUrl = url;
    }
  }

  async eval (code) {
    if (!this.window || this.window.isDestroyed()) {
      throw new Error('DeepSeek 浏览器未打开');
    }
    return this.window.webContents.executeJavaScript(code, true);
  }

  async waitFor (code, timeoutMs, intervalMs = 500) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      // 窗口被用户关闭时提前结束，避免白等
      if (!this.window || this.window.isDestroyed()) return null;
      try {
        const result = await this.eval(code);
        if (result) return result;
      } catch (error) {
        // 页面可能还在加载，忽略
      }
      await sleep(intervalMs);
    }
    return null;
  }

  findInputJS () {
    const selectors = JSON.stringify(INPUT_SELECTORS);
    return `(() => {
      for (const selector of ${selectors}) {
        const el = document.querySelector(selector);
        if (el) return true;
      }
      return false;
    })()`;
  }

  readLastReplyJS () {
    const selectors = JSON.stringify(REPLY_SELECTORS);
    return `(() => {
      for (const selector of ${selectors}) {
        const els = Array.from(document.querySelectorAll(selector));
        const top = els.filter(el => !el.parentElement || !el.parentElement.closest(selector));
        const last = top.length ? top[top.length - 1] : els[els.length - 1];
        const text = last ? last.innerText : '';
        if (text && text.trim()) return text.trim();
      }
      return null;
    })()`;
  }

  /** 本地持久化会话中是否已有登录态（userToken + 输入框可见） */
  async hasSession () {
    await this.goto(CHAT_URL);
    const ready = await this.waitFor(`(() => Boolean(localStorage.getItem('userToken') && document.querySelector('textarea')))()`, 20000, 700);
    return Boolean(ready);
  }

  /** 打开可见窗口让用户登录，等待 userToken 出现 */
  async login () {
    await this.ensureWindow(true);
    await this.window.loadURL(LOGIN_URL);
    this.loadedUrl = LOGIN_URL;
    const ok = await this.waitFor(`Boolean(localStorage.getItem('userToken'))`, 300000, 1000);
    if (!ok) {
      throw new Error('DeepSeek 登录超时（5 分钟内未检测到登录态）');
    }
    // 登录后跳回对话页
    await this.window.loadURL(CHAT_URL);
    this.loadedUrl = CHAT_URL;
    this.window.hide();
    return {ok: true};
  }

  /** 发送消息并等待回复（返回 {"message": str}） */
  async input (message) {
    await this.goto(CHAT_URL);
    const inputReady = await this.waitFor(this.findInputJS(), 20000, 500);
    if (!inputReady) {
      const token = await this.eval(`Boolean(localStorage.getItem('userToken'))`).catch(() => false);
      if (!token) throw new Error('DeepSeek 未登录，请先在 AI 设置中点击“登录 DeepSeek”');
      throw new Error('未找到聊天输入框，可能是页面结构已变化或未进入对话页');
    }

    const baseline = await this.eval(this.readLastReplyJS()).catch(() => null);

    // 填入消息（React 受控输入需要原生 setter + input 事件）
    const fillJS = `(() => {
      const selectors = ${JSON.stringify(INPUT_SELECTORS)};
      let el = null;
      for (const selector of selectors) {
        el = document.querySelector(selector);
        if (el) break;
      }
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(message)});
      el.dispatchEvent(new Event('input', {bubbles: true}));
      return true;
    })()`;
    const filled = await this.eval(fillJS);
    if (!filled) throw new Error('无法写入聊天输入框');

    // 回车发送
    await this.eval(`(() => {
      const selectors = ${JSON.stringify(INPUT_SELECTORS)};
      let el = null;
      for (const selector of selectors) {
        el = document.querySelector(selector);
        if (el) break;
      }
      if (!el) return false;
      el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', bubbles: true, cancelable: true}));
      el.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', code: 'Enter', bubbles: true, cancelable: true}));
      return true;
    })()`);

    // 等输入框清空（消息已被页面接收）；否则点发送按钮兜底
    const cleared = await this.waitFor(`(() => {
      const selectors = ${JSON.stringify(INPUT_SELECTORS)};
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) return el.value === '';
      }
      return true;
    })()`, 3000, 300);
    if (!cleared) {
      const clicked = await this.eval(`(() => {
        for (const selector of ${JSON.stringify(SEND_BUTTON_SELECTORS)}) {
          const el = document.querySelector(selector);
          if (el) { el.click(); return true; }
        }
        return false;
      })()`);
      if (!clicked) throw new Error('消息未发送，且找不到发送按钮');
    }

    // 等新回复出现并稳定（流式结束）
    const reply = await this.waitForReply(baseline, 180000);
    return {message: reply};
  }

  async waitForReply (baseline, timeoutMs) {
    const start = Date.now();
    let lastSeen = null;
    let stableSince = null;
    while (Date.now() - start < timeoutMs) {
      const text = await this.eval(this.readLastReplyJS()).catch(() => null);
      if (text && text !== baseline) {
        if (text === lastSeen) {
          if (stableSince !== null && Date.now() - stableSince >= 1000) {
            return text;
          }
        } else {
          lastSeen = text;
          stableSince = Date.now();
        }
      }
      await sleep(500);
    }
    throw new Error('等待 DeepSeek 回复超时（180 秒）');
  }

  close () {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
    this.loadedUrl = null;
  }
}

// 模块级单例：所有编辑器窗口共享同一个浏览器会话
const instance = new DeepSeekWeb();

module.exports = {
  DeepSeekWeb,
  instance
};
