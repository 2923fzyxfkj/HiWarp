# HiWarp Desktop 技术文档

> 面向对象：想读懂、修改、二次开发或审计 HiWarp Desktop 源码的人
> 覆盖范围：整个仓库（Electron 主进程、预加载脚本、编辑器渲染层、AI 模块、文本编程语言、侧栏系统、待办清单、补丁系统、扩展系统、构建与发布链路、版权合规）
> 上游基线：TurboWarp Desktop（`docs` 官网与 `changelog.md` 均为上游产物）
> 代码基线：`2.0.2-alp.1`（commit `2c354d1` 之后）
> 最后核对：2026-10-26

关联文档：`docs/RIIR-MILESTONES.md`（Rust 重写里程碑；当前状态为「暂缓」，该文档引用本文档作为现状说明）

---

## 目录

1. [项目定位](#1-项目定位)
2. [进程与目录架构](#2-进程与目录架构)
3. [核心模块](#3-核心模块)
4. [构建、打包与发布](#4-构建打包与发布)
5. [版权与合规](#5-版权与合规)
6. [已知限制与风险](#6-已知限制与风险)
7. [故障排查](#7-故障排查)
8. [附录](#附录-a目录速查)

---

# 1. 项目定位

## 1.1 与上游的关系

HiWarp Desktop 是 **TurboWarp Desktop 的二次开发版本（fork）**。仓库保留上游的绝大部分架构：

- Electron 主进程 / 渲染进程分离的窗口模型
- 自定义协议（`tw-*://`）加载本地页面与资源
- Scratch GUI / VM / Render 三件套（以 GitHub 依赖形式引入，源码不在本仓库，但 HiWarp 的改动通过 `patches/` 管理）
- 打包器（Packager）、加载项（Addons）、迁移（Migrate）、更新检查等原有能力

HiWarp 在其上新增了六类自研能力：

| 能力 | 说明 | 主要代码位置 |
| --- | --- | --- |
| AI 助手 | 侧边栏 + 独立窗口，可读写项目（积木、角色、变量、造型、声音、扩展） | `src-main/ai-service.js`、`src-renderer-webpack/editor/gui/ai-sidebar.jsx` |
| 免费 DeepSeek | 无需 API Key、无需外部依赖的对话通道 | `src-main/deepseek-free.js`、`src-main/deepseek-web.js` |
| 文本编程 .sp | 中文文本语言，一个文件描述整个项目 | `src-renderer-webpack/editor/scratch-text/` |
| 侧栏停靠系统 | 侧栏标签可收起、可拖出成浮动栏，多侧栏共用 | `src-renderer-webpack/editor/gui/dock-tabs.js` 等 |
| 待办清单 | 随 `.sb3` 项目保存的待办/分类清单 | `src-renderer-webpack/editor/gui/todo-sidebar.jsx`、`todo-store.js` |
| 内置扩展 | 多源扩展库（含 02Engine / PenguinMod / CCW / hidream 扩展） | `patches/`、`dist-extensions`、`dist-library-files` |

> 说明：`docs/` 同时存放上游官网源码、本技术文档与 RIIR 里程碑文档；`changelog.md` 是上游用来生成官网更新页的权威文件，**不要**把 HiWarp 的版本记录混进去（Windows 上大小写不敏感，`CHANGELOG.md` 与它是同一个文件）。

## 1.2 技术栈

| 层 | 技术 | 版本来源 |
| --- | --- | --- |
| 桌面容器 | Electron | `package.json` devDependencies（当前 42.x） |
| 编辑器 UI | React + Redux + scratch-gui | GitHub 依赖 `TurboWarp/scratch-gui#develop` |
| 运行时 | scratch-vm / scratch-render | 随 scratch-gui 依赖树引入 |
| 构建 | webpack 4 + Babel 7 | `webpack.config.cjs`（babel-loader 的 presets 内联在该文件） |
| 打包 | electron-builder 26 | `package.json` 的 `build` 字段 + `electron-builder.hiwarp-*.cjs` |
| 语言 | JavaScript / JSX（无 TypeScript） | 全仓库 |

## 1.3 产品标识

品牌字符串集中在 `src-main/brand.js`，改品牌只需改这一处（构建产物命名除外，见 4.9）：

```js
const PLATFORM_NAME = 'HiWarp';           // 平台名，用于界面展示
const APP_NAME = 'HiWarp Desktop';        // 应用名，用于窗口标题、错误弹窗
const PACKAGER_NAME = 'HiWarp Packager';  // 打包器名称
const APP_ID = 'org.hiwarp.desktop.alpha';// Windows AppUserModelID / AppId
const APP_USER_DATA_NAME = 'hiwarp-desktop'; // 用户数据目录名
```

主题强调色（HiWarp 蓝 `#4c97ff`）在 `src-renderer-webpack/editor/gui/gui.html` 的 `accent` 变量中定义；侧栏面板另有一套青蓝配色，统一由 `dock-tabs.js` 导出（见 3.4）。窗口背景色与图标分别在各自窗口类与 `art/`、`build/` 中定义。

---

# 2. 进程与目录架构

## 2.1 进程模型

| 类别 | 目录 | 构建方式 | 职责 |
| --- | --- | --- | --- |
| 主进程 | `src-main` | 无构建，原样执行 | 窗口管理、IPC、设置、协议、AI 服务、打包器、更新、日志 |
| 预加载脚本 | `src-preload` | 无构建 | 通过 `contextBridge` 向渲染层暴露受控 API |
| 渲染层（webpack） | `src-renderer-webpack` | webpack → `dist-renderer-webpack` | 编辑器主界面、侧栏、加载项页面 |
| 渲染层（静态） | `src-renderer` | 无构建，直接加载 HTML | 关于、隐私、更新、反馈、AI 聊天窗口、打包器页面等 |

渲染层不直接访问 Node：

- 主进程侧：`src-main/windows/*.js` 使用 `ipc.handle(...)` / `ipc.on(...)`
- 渲染侧：`src-preload/*.js` 用 `ipcRenderer.invoke/send/on` 包装后经 `contextBridge` 暴露
- 页面侧：编辑器通过 `EditorPreload`（浏览器环境由 `src-renderer-webpack/editor/gui/web-preload-shim.js` 降级）

## 2.2 目录职责

```
src-main/              Electron 主进程（入口 entrypoint.js → index.js）
  windows/             各类窗口：editor / ai-chat / about / packager / settings ...
  ai-service.js        AI 助手服务端逻辑（模型调用、上下文、操作下发）
  deepseek-free.js     免费 DeepSeek 门面（内置实现 + Python 回退）
  deepseek-web.js      免费 DeepSeek 的 Electron 原生实现
  protocols.js         自定义协议注册与资源响应
  settings.js          用户设置读写（tw_config.json）
  logging.js           日志系统（文件 + 渲染层日志汇聚）
  seven-zip.js         7-Zip 集成（打包器用）
src-preload/           各窗口预加载脚本（editor.js、ai-chat.js 等）
src-renderer-webpack/  webpack 构建的渲染层
  editor/gui/          编辑器主界面（desktop-hoc.jsx 为桌面版接线层）
    ai-sidebar.jsx       AI 助手侧栏（含操作执行器）
    todo-sidebar.jsx     待办清单侧栏
    todo-store.js        待办数据层（纯函数）+ todo-store.test.mjs
    dock-tabs.js         侧栏停靠/浮动共享状态与配色
    dockable-tab.jsx     标签拖拽组件
    dock-tabs-bar.jsx    浮动标签汇总栏
  editor/scratch-text/  .sp 文本编程（核心 + 面板）
patches/               node_modules 补丁（受版本控制，npm ci 后需重新应用）
  apply.mjs            补丁应用脚本（幂等，失败非 0 退出）
  scratch-gui/         整文件补丁（加密弹窗、扩展导入、hidream 扩展等）
  scratch-vm/          整文件补丁 + sb3 序列化字符串锚点补丁
SpeedScript/           发布辅助脚本（打包 / Web 构建 / 版权声明 / .sp 测试）
dist-extensions/       npm run fetch 生成的扩展产物（brotli 压缩）
dist-library-files/    npm run fetch 生成的扩展库资源
docs/                  上游官网源码 + 本技术文档 + RIIR 里程碑
scripts/               资源拉取脚本（npm run fetch 调用）
```

## 2.3 自定义协议

`src-main/protocols.js` 注册了一组特权协议，把本地文件映射为安全的「伪 https」来源：

| 协议 | 对应内容 |
| --- | --- |
| `tw-editor://` | 编辑器界面（`dist-renderer-webpack/editor/gui/gui.html`） |
| `tw-ai-chat://` | AI 聊天窗口页面 |
| `tw-desktop-settings://` | 桌面设置页 |
| `tw-privacy://` / `tw-about://` / `tw-update://` / `tw-feedback://` | 对应静态页面 |
| `tw-packager://` | 打包器页面及其预览 |
| `tw-library://` | 扩展库资源（`dist-library-files`） |
| `tw-extensions://` | 扩展脚本资源（`dist-extensions`，优先读 `.br` 压缩版本） |
| `tw-security-prompt://` / `tw-file-access://` | 权限提示与文件访问页 |

安全约束：

- 响应头由 `getBaseProtocolHeaders()` 统一设置，禁止被扩展页面嵌入
- 文件读取限定在协议声明的根目录内（路径越界会被拒绝）
- 兼容旧 Electron 的分支保留 `registerBufferProtocol` / `registerFileProtocol` 回退

## 2.4 启动流程

```
electron src-main/entrypoint.js
  └─ entrypoint.js        最小化错误处理：捕获启动期异常并弹窗，patch console 到日志
       └─ index.js        app.setName / userData 路径 / 单实例锁 / 沙箱 / 崩溃上报
            ├─ settings.js      读取 tw_config.json（含 aiConfig）
            ├─ logging.js       建立日志文件（userData/logs）
            ├─ migrate.js       旧版本数据迁移
            └─ new EditorWindow(...)
                 ├─ 创建 BrowserWindow（preload: editor，尺寸 1280×800）
                 ├─ new AIService(this) + attachIPC(ipc, true)
                 ├─ 注册 open-ai-chat / open-scratch-text-file 等 IPC
                 └─ loadURL('tw-editor://./gui/gui.html')
                      └─ index.jsx → gui.jsx → desktop-hoc.jsx
                           ├─ <AIChatSidebar vm={vm} />
                           ├─ <ScratchTextSidebar vm={vm} />
                           ├─ <TodoSidebar vm={vm} />
                           └─ <DockTabsBar />           浮动标签汇总栏
```

关键点：

- `src-main/index.js` 调用 `app.enableSandbox()`，并把 `device-manager.scratch.mit.edu` 解析指向本地，避免离线环境卡顿。
- 编辑器窗口创建 `AIService` 实例；AI 聊天独立窗口通过 `registerView` 与该实例共享状态。
- 三个侧栏在「受限模式」（加密项目凭据错误）下都会被隐藏，见 `desktop-hoc.jsx` 的条件渲染。

## 2.5 数据与配置存储

用户数据目录由 `src-main/brand.js` 定义：`appData/hiwarp-desktop`（Windows 下即 `%APPDATA%\hiwarp-desktop`）。

| 文件 / 目录 | 内容 | 产生位置 |
| --- | --- | --- |
| `tw_config.json` | 桌面设置与 `aiConfig`（AI 配置、权限） | `src-main/settings.js` |
| `ai-api-key.bin` | API Key，使用 Electron `safeStorage` 加密；不可用时退化为内存保存 | `src-main/ai-service.js` |
| `ai-last-session.json` | 上次 AI 对话记录（可「继续上次会话」） | `src-main/ai-service.js` |
| `logs/hiwarp-<date>.log` | 运行日志（主进程 + 渲染层汇聚） | `src-main/logging.js` |
| `persist:deepseek-free`（Chromium 分区） | DeepSeek 网页登录态 | `src-main/deepseek-web.js` |
| `localStorage: hiwarp:tab-top:<key>` | 各侧栏标签的竖直位置（浮动状态本身不持久化） | `dockable-tab.jsx` |
| 项目内的 `hiwarpTodos` 字段 | 待办清单数据，随 `.sb3` / `.hwp` 一起保存 | `todo-store.js` + `patches/apply.mjs` |

---

# 3. 核心模块

## 3.1 AI 助手

### 3.1.1 组成

| 部分 | 文件 | 说明 |
| --- | --- | --- |
| 服务端 | `src-main/ai-service.js` | 组装提示词、调用模型、解析操作、下发到编辑器、持久化会话 |
| 侧边栏 UI | `src-renderer-webpack/editor/gui/ai-sidebar.jsx` | 对话、设置、上下文选择、审查卡片、撤销、操作执行器 |
| 独立窗口 | `src-main/windows/ai-chat.js` + `src-renderer/ai-chat/index.html` | 与侧边栏等价的大窗口对话界面 |
| 预加载 | `src-preload/ai-chat.js`、`src-preload/editor.js` 的 `ai` 命名空间 | 通道白名单 |

### 3.1.2 配置项

`DEFAULT_CONFIG`（`src-main/ai-service.js`）定义全部可配置项，保存时写入 `settings.aiConfig`：

| 字段 | 含义 | 默认值 |
| --- | --- | --- |
| `apiUrl` | OpenAI 兼容服务地址（请求 `${apiUrl}/models`、`${apiUrl}/chat/completions`） | 空 |
| `model` | 模型名 | 空 |
| `contextMode` | 上下文模式：`target`（当前角色）/ `project`（整个项目）/ `custom`（自选） | `target` |
| `freeDeepSeek` | 是否启用免费 DeepSeek 通道 | `false` |
| `freeDeepSeekPython` | Python 解释器路径（留空即用内置实现） | 空 |
| `webSearch.urlTemplate` | 联网搜索 URL 模板，支持 `{ask}` 占位 | `https://cn.bing.com/search?q={ask}` |
| `webSearch.proxyMode` / `proxyAddress` / `requestTool` / `customCommand` | 搜索请求的代理与工具配置 | `system` / 空 / `curl` / 空 |
| `permissions` | 操作权限开关（见 3.1.6） | 见该节表格 |

API Key 不写入 `tw_config.json`，而是单独存入 `ai-api-key.bin`（`safeStorage` 加密）。

### 3.1.3 上下文构建

编辑器侧 `makeContext(vm, mode, selection)` 把 VM 状态序列化成提示词可读结构：

- `target`：当前编辑角色（舞台可切换）
- `project`：所有角色 + 舞台
- `custom`：由用户在设置面板勾选的角色与脚本

发送消息前后有两个关键动作：

1. 侧边栏通过 `ai:set-context-catalog` 上报角色/脚本清单，供设置面板展示可选项。
2. 主进程在**每次发送前**重新请求上下文（`ai:request-context`），避免使用过期的 `targetId` / `rootBlockId`。

服务端再把上下文压缩成提示词（`buildSystemPrompt` 系列），并对历史消息做裁剪（`compactMessageForPrompt`）。

### 3.1.4 会话

| 能力 | 实现 |
| --- | --- |
| 新建会话 | `startNewSession()` |
| 继续上次 | `continueLastSession()`，读取 `ai-last-session.json` |
| 自动保存 | 每轮结束后 `persistCurrentSession()` |
| 安全过滤 | `sanitizeMessagesForSession()` 只保留合法角色与字段 |

### 3.1.5 操作协议

模型需在回复中输出 `ai-operations` 代码块（JSON，也兼容 XML 形式）。主进程 `extractOperations()` 提取，编辑器 `applyOperations()` 执行。

| 类型 | 作用 | 主要参数 |
| --- | --- | --- |
| `insertScript` | 新建脚本 | `targetId`、`xml` |
| `replaceScript` | 替换脚本 | `targetId`、`rootBlockId`、`xml` |
| `deleteScript` | 删除脚本 | `targetId`、`rootBlockId` |
| `loadExtension` | 加载扩展 | `extensionId` 或 `url` |
| `uploadCostume` / `uploadBackdrop` | 上传造型/背景（按 URL 下载） | `targetId`、`url`、`name` |
| `uploadSound` | 上传声音（按 URL 下载） | `targetId`、`url`、`name` |
| `deleteCostume` / `deleteSound` | 删除造型/声音 | `targetId`、`name` |
| `updateVariable` | 修改变量值 | `targetId`、`variableId`、`value` |
| `createVariable` / `deleteVariable` | 新建/删除变量 | `targetId`、`name` |
| `updateSprite` / `updateTarget` | 修改角色属性（位置、方向、大小、可见、音量、造型等） | 对应属性字段 |
| `selectTarget` | 切换当前编辑角色 | `targetId` |
| `duplicateTarget` / `deleteTarget` | 复制/删除角色 | `targetId` |
| `greenFlag` / `stopAll` | 运行/停止项目 | 无 |
| `callVmMethod` | 调用 VM 白名单方法 | `method`、`args` |
| `callTargetMethod` | 调用目标白名单方法 | `targetId`、`method`、`args` |

安全设计：

- `callVmMethod` 仅允许 `greenFlag`、`stopAll`、`setTurboMode`、`setInterpolation`、`setFramerate`、`setRuntimeOptions`、`setEditingTarget`
- `callTargetMethod` 仅允许 `setXY`、`setDirection`、`setSize`、`setVisible`、`setRotationStyle`、`setCostume`、`createVariable`、`deleteVariable`
- 参数数量与类型受限（`ensureSafeArgs`）
- Blockly XML 做注入检查，拒绝 `<!doctype`、`<!entity`、`<script>`

### 3.1.6 权限与审查

`DEFAULT_PERMISSIONS` 默认策略是「只读 + 新建脚本」，其余默认关闭：

| 权限键 | 界面名称 | 默认 |
| --- | --- | --- |
| `insertScript` | 新建脚本 | 开 |
| `replaceScript` | 替换脚本 | 开 |
| `deleteScript` | 删除脚本 | 关 |
| `updateVariable` | 编辑变量 | 关 |
| `updateSprite` | 编辑角色属性 | 关 |
| `updateTarget` | 编辑角色/舞台 | 关 |
| `loadExtension` | 添加扩展 | 关 |
| `manageTargets` | 管理角色/舞台 | 关 |
| `projectControl` | 控制项目运行 | 关 |
| `callVmMethod` | 调用 VM 白名单 | 关 |
| `callTargetMethod` | 调用目标白名单 | 关 |

执行流程（`ai-sidebar.jsx`）：

```
AI 回复
  └─ 主进程提取操作
       └─ 下发 ai:apply-operations
            └─ 侧栏渲染审查卡片（逐条列出将执行的操作）
                 ├─ 用户确认 → 保存快照 → applyOperations() 执行 → 回传结果
                 └─ 用户拒绝 → 丢弃本次操作
```

### 3.1.7 撤销

确认执行前保存快照（涉及角色的积木序列 + 变量旧值），执行成功后压入 `undoStack`，通过 `slice(-9)` 保留最近 10 次。点击「撤销」逐个恢复并出栈。

### 3.1.8 失败自动修正

操作失败时，主进程把错误信息 + 当前有效角色 ID 列表回传模型做一次修正（`requestOperationRevision`），提示词要求 `targetId` 逐字符精确复制。修正后仍失败则把错误展示给用户。

### 3.1.9 IPC 通道

| 通道 | 方向 | 说明 |
| --- | --- | --- |
| `ai:get-state` | 渲染 → 主 | 获取配置与会话状态 |
| `ai:save-config` | 渲染 → 主 | 保存配置（含 API Key 加密） |
| `ai:fetch-models` | 渲染 → 主 | 拉取模型列表 |
| `ai:continue-last-session` / `ai:start-new-session` | 渲染 → 主 | 会话切换 |
| `ai:set-context-catalog` | 渲染 → 主 | 上报可选择的上下文集合 |
| `ai:upload-context` | 渲染 → 主 | 上传上下文快照 |
| `ai:send-message` | 渲染 → 主 | 发送消息（模型调用在主进程完成） |
| `ai:recognize-speech` | 渲染 → 主 | 语音识别（Windows 走系统语音 API） |
| `ai:free-check-login` / `ai:free-login` / `ai:free-close` | 渲染 → 主 | 免费 DeepSeek 登录态管理 |
| `ai:request-context` | 主 → 编辑器 | 请求最新上下文 |
| `ai:apply-operations` | 主 → 编辑器 | 下发操作清单待审查 |
| `ai:editor-response` | 编辑器 → 主 | 回传操作结果/错误 |
| `ai:state` | 主 → 所有视图 | 广播状态变化 |

### 3.1.10 消息渲染（Markdown）

AI 回复按 Markdown 渲染，用户消息保持纯文本。两处界面用的是**同一个引擎**，但接入方式不同：

| 界面 | 实现 | 依赖来源 |
| --- | --- | --- |
| 侧栏 `ai-sidebar.jsx` | `import MarkdownIt from 'markdown-it'` + `DOMPurify`，产物里内联 | **未在 `package.json` 声明**，靠 `@turbowarp/extensions` / `@turbowarp/scratch-svg-renderer` 传递带入 |
| 独立窗口 `src-renderer/ai-chat/index.html` | `<script src="vendor/markdown-it.min.js">` + `vendor/purify.min.js`（UMD） | 仓库内 vendor 副本，见 `src-renderer/ai-chat/vendor/README.md` |

共同约束：

- `markdown-it` 配置 `html:false, linkify:true, breaks:true`，输出再经 `DOMPurify.sanitize()`，双重防注入
- 链接加 `target="_blank"`，由 `AbstractWindow.handleWindowOpen` 转交系统浏览器打开
- 流式回复会不断产生中间态文本，两处都用带上限（200 条）的缓存避免重复解析
- 独立窗口在 vendor 库加载失败时自动回退纯文本（`renderMarkdown()` 返回 `null` 时走 `textContent`）
- `tw-ai-chat` 必须注册为 **standard scheme**（`standard: true, secure: true`），并且 CSP 写成 `script-src 'self' tw-ai-chat: 'unsafe-inline'`。**只加 `'self'` 不够**：非 standard 协议的源是不透明源，`'self'` 永远匹配不上，vendor 脚本会被静默拦截，页面只剩回退的纯文本，且只在主进程日志里留下一行 `violates ... script-src 'self'`

已知限制：CSP 的 `default-src 'none'` 未放开 `img-src`，所以 Markdown 图片不会显示（侧栏同理）。

自测：`node src-renderer/ai-chat/markdown-vendor.test.mjs`

## 3.2 免费 DeepSeek

### 3.2.1 设计目标

无需 API Key、无需安装 Python 或任何第三方库。HiWarp 直接用 Electron 自带的 Chromium 打开 `chat.deepseek.com`，让页面自身处理登录、PoW 与流式输出，应用只负责「输入消息」和「读取回复」。

### 3.2.2 分层

| 文件 | 职责 |
| --- | --- |
| `src-main/deepseek-free.js` | 门面：默认调用内置实现；若用户显式配置 `freeDeepSeekPython`，回退 Python 桥接 |
| `src-main/deepseek-web.js` | 内置实现（Electron 原生，推荐路径） |

### 3.2.3 内置实现（deepseek-web.js）

BrowserWindow 参数要点：

| 参数 | 值 | 目的 |
| --- | --- | --- |
| `partition` | `persist:deepseek-free` | 登录态持久化到独立分区 |
| `contextIsolation` / `nodeIntegration` / `sandbox` | `true` / `false` / `true` | 页面无法访问 Node |
| `backgroundThrottling` | `false` | 隐藏窗口时定时器不被节流，保证流式输出 |
| `show` | 登录时可见，对话时隐藏 | 首次登录需用户完成验证 |

导航限制：只允许 `https://*.deepseek.com/`，其余一律阻止（`setWindowOpenHandler` 全部 deny）。

交互流程：

```
checkLogin()
  └─ goto(chat.deepseek.com)
       └─ 等待 localStorage.userToken 且页面出现 textarea
            ├─ 已登录 → true
            └─ 未登录 → login() 打开可见窗口等待用户（最长约 300s）

input(message)
  ├─ 等待输入框就绪
  ├─ 读取现有最后一条回复作为 baseline
  ├─ 用原生 setter + input 事件写入文本（兼容 React 受控组件）
  ├─ 触发发送（回车为主，发送按钮兜底）
  └─ waitForReply(baseline, 180s)
        └─ 轮询最后一条回复：与 baseline 不同且连续 1s 稳定 → 视为完成
```

超时与错误：

- 操作级超时见 `src-main/deepseek-free.js` 的 `getTimeout()`：登录 ≈360s、对话 ≈300s（其中等待回复上限 180s）、其他 ≈30s
- 错误经 `translateFreeDeepSeekError()` 转为中文提示
- 窗口被关闭时轮询立即结束

维护风险：回复读取依赖对方 DOM 结构（`div.ds-markdown` 等选择器），改版需更新 `src-main/deepseek-web.js` 顶部的选择器常量。

### 3.2.4 Python 回退

仅当用户显式填写 `freeDeepSeekPython` 时启用，兼容旧的 `deepseek-notoken-api` 环境：

- 解释器解析顺序：配置路径 → 项目内 `.venv-deepseek` → 常见虚拟环境位置 → PATH 中的 `python`
- 调用方式：`python -c <内联脚本> <action>`，参数走 stdin 传 JSON（避免超长上下文触发 Windows 命令行长度限制）

## 3.3 Scratch 文本编程（.sp）

### 3.3.1 语言定位

一个 `.sp` 文件描述**整个项目**：项目标题、项目级设置、舞台脚本、各角色脚本。设计目标是让 AI 或人工直接生成/编辑纯文本项目，再转成积木或完整项目。

### 3.3.2 语法

```text
项目: 我的项目
设置 帧率 60
设置 补帧 开启
导入扩展 pen

舞台:
  当绿旗被点击
    说 欢迎来到画板

角色: 角色1
  当绿旗被点击
    重复 999 次
      移动 10 步
```

规则：

- `项目:` / `设置` / `导入扩展` 必须出现在任何目标段之前
- `舞台:` 与 `角色: 名称` 是段标记，其后缩进内容属于该目标
- 没有段标记时整份文本视为单个目标（插入模式落在当前角色，加载模式生成「角色1」）
- 缩进表示嵌套，子行必须比父行更深（2 或 4 空格均可）
- 条件表达式接受全角/半角问号（`按下鼠标？` 与 `按下鼠标?`）

项目级设置（`SETTINGS` 表）：

| 写法 | 内部键 | 取值 |
| --- | --- | --- |
| `帧率` / `fps` | `framerate` | 数字 |
| `补帧` | `interpolation` | 开启/关闭 |
| `高清画笔` | `highQualityPen` | 开启/关闭 |
| `无限克隆` | `infiniteClones` | 开启/关闭 |
| `移除围栏` | `removeFencing` | 开启/关闭 |
| `移除杂项限制` | `removeMiscLimits` | 开启/关闭 |
| `编译器快速计时器` | `warpTimer` | 开启/关闭 |
| `编译器` | `compiler` | 开启/关闭 |
| `Turbo模式` | `turboMode` | 开启/关闭 |
| `兼容模式` | `compatibilityMode` | 开启/关闭 |
| `舞台尺寸` | `stageSize` | `宽x高`，如 `960x720` |

布尔值接受 `开启/启用/开/true/on/是` 与 `关闭/禁用/关/false/off/否`。

帽子积木：

| 写法 | 对应积木 |
| --- | --- |
| `当绿旗被点击` | `event_whenflagclicked` |
| `当角色被点击` | `event_whenthisspriteclicked` |
| `当按下 X 键` | `event_whenkeypressed` |

语句（`STATEMENTS` 表）：

| 写法 | 对应积木 |
| --- | --- |
| `说 内容`、`说 内容 持续 N 秒` | `looks_say` / `looks_sayforsecs` |
| `思考 内容` | `looks_think` |
| `移动 N 步` | `motion_movesteps` |
| `左转/右转 N 度` | `motion_turnleft` / `motion_turnright` |
| `面向 N 度` | `motion_pointindirection` |
| `移到 x:0 y:0` | `motion_gotoxy` |
| `等待 N 秒` | `control_wait` |
| `重复 N 次` / `重复无限次` | `control_repeat` / `control_forever` |
| `如果 <条件> 那么` … `否则` | `control_if_else` |
| `停止 全部` / `停止 这个脚本` | `control_stop` |
| `显示` / `隐藏` | `looks_show` / `looks_hide` |
| `广播 名称` | `event_broadcast` |
| `换成 造型名 造型` | `looks_switchcostumeto` |
| `将 变量 设为 值` | `data_setvariableto` |
| `将 变量 增加 N` | `data_changevariableby` |
| `播放声音 名称` | `sound_play` |

条件（`CONDITIONS` 表）：

| 写法 | 对应积木 |
| --- | --- |
| `按下鼠标？` | `sensing_mousedown` |
| `按下 X 键？` | `sensing_keypressed` |
| `A 大于 B` / `A 小于 B` / `A 等于 B` | `operator_gt` / `operator_lt` / `operator_equals` |

### 3.3.3 解析流程

`parse(text, options)`（`src-renderer-webpack/editor/scratch-text/scratch-text.js`）：

1. 按行切分、丢弃空行，保留行号用于报错
2. 计算缩进，维护「嵌套栈」（`statement` / `body` / `scripts` / `indent`）
3. 进入目标段前用 `matchDirective()` 解析项目标题、设置、扩展导入
4. 用 `matchHat()` 识别帽子并开启新脚本
5. 用 `matchStatement()` / `matchCondition()` 识别语句与条件，按缩进挂到父节点
6. 产生 AST：

```js
{
  title: '我的项目',
  settings: [{key: 'framerate', value: 60}, {key: 'extension', value: 'pen'}],
  targets: [
    {name: 'Stage', isStage: true, scripts: [{hat: {...}, body: [...]}]},
    {name: '角色1', isStage: false, scripts: [...]}
  ],
  hasSections: true
}
```

错误处理：未知语句/设置、布尔值或数字格式错误、`舞台尺寸` 格式错误都会抛出带行号的中文错误。

### 3.3.4 两种转换方式

| 模式 | 入口函数 | 产物 | 行为 |
| --- | --- | --- | --- |
| 插入到项目 | `compileToXML(target)` | Blockly XML | 逐目标匹配现有角色（舞台匹配舞台），通过 `vm.setEditingTarget` + `Blockly.Xml.domToWorkspace` 插入 |
| 加载为新项目 | `compileToSB3(ast)` | SB3（zip） | 由 `compileToProjectJSON()` 生成完整 `project.json`，用 `@turbowarp/jszip` 打包后交给 `vm.loadProject` 替换当前项目 |

加载模式生成的 `project.json` 特点：

- 每个角色使用 1×1 SVG 占位造型（固定资产 id），因此没有真实造型与声音
- 目标段中出现的变量会声明到对应目标
- `导入扩展` 写入 `extensions` / `extensionURLs`
- 项目标题写入 `meta.title`

插入模式会一并应用项目级设置，映射关系：

| 设置 | 调用 |
| --- | --- |
| `framerate` | `vm.setFramerate(value)` |
| `interpolation` | `vm.setInterpolation(value)` |
| `highQualityPen` | `vm.renderer.setUseHighQualityRender(value)`（渲染器支持时） |
| `infiniteClones` | `vm.setRuntimeOptions({maxClones: Infinity / 300})` |
| `removeFencing` | `vm.setRuntimeOptions({fencing: !value})` |
| `removeMiscLimits` | `vm.setRuntimeOptions({miscLimits: !value})` |
| `warpTimer` | `vm.setCompilerOptions({warpTimer: value})` |
| `compiler` | `vm.setCompilerOptions({enabled: value})` |
| `turboMode` | `vm.setTurboMode(value)` |
| `compatibilityMode` | `vm.setCompatibilityMode(value)` |
| `stageSize` | `vm.setStageSize(width, height)` |
| `extension` | 扩展管理器 `loadExtensionURL` / `loadExtensionIdSync` |

### 3.3.5 面板与 IPC

`src-renderer-webpack/editor/scratch-text/sidebar.jsx` 提供右侧面板：

- 文本编辑区（普通 textarea，暂无语法高亮）
- 「导入 .sp」：`EditorPreload.openScratchTextFile()` → 主进程 `open-scratch-text-file`，系统文件对话框读取 UTF-8 文本（兼容中文/空格路径）
- 「插入到项目」/「加载为新项目」
- 状态区：已插入的角色与积木数量、已应用设置、错误信息

### 3.3.6 当前限制

- 仅「文本 → 积木」，无反向导出
- 加载模式没有真实造型/声音；变量输入以文本 shadow 填充
- 无语法高亮与自动补全
- 新增积木需在 `STATEMENTS` / `CONDITIONS` / `HATS` 表中加规则

自测脚本：`SpeedScript/scratch-text-test.js`（独立运行，未接入 npm scripts）。

## 3.4 侧栏停靠系统（Dock）

三个侧栏（AI 助手、文本编程、待办）共用同一套「收起标签 / 拖出浮动」机制，避免各自实现一遍。

### 3.4.1 分层

| 文件 | 职责 |
| --- | --- |
| `dock-tabs.js` | 共享状态（模块级单例 + 订阅）与统一配色常量 |
| `dockable-tab.jsx` | 单个标签的渲染与拖拽判定（竖直拖动、拉出阈值） |
| `dock-tabs-bar.jsx` | 汇总栏：渲染已拖出的浮动标签，可拖回 |

### 3.4.2 状态设计

- 用**模块级单例 + 订阅**而非 React Context：标签组件分散在各侧栏组件树内部，跨树共享状态最简单
- `undocked` 映射：`tabKey -> {key, label, side, top, onOpen}`
- API：`undockTab(entry)`、`redockTab(key)`、`useDockTabs()`
- **故意不持久化浮动状态**：按需求重启后所有标签归位；只有标签的竖直位置存 `localStorage`（键 `hiwarp:tab-top:<tabKey>`）

### 3.4.3 拖拽判定

| 常量 | 值 | 含义 |
| --- | --- | --- |
| `PULL_THRESHOLD` | 60 | 水平拖动超过该距离判定为「拖出」 |
| `MOVE_THRESHOLD` | 4 | 小于该位移视为点击 |
| `EDGE_MARGIN` | 24 | 竖直位置边界 |
| `BOTTOM_RESERVE` | 120 | 底部预留，避免标签被推出可视区 |

配色常量集中在 `dock-tabs.js` 导出（`ACCENT_FROM`、`ACCENT_TO`、`TEXT_COLOR`、`PANEL_BG`、`PANEL_SOLID`、`ACCENT_GRADIENT`），侧栏面板与标签共用，避免散落硬编码色值。

## 3.5 待办清单侧栏

### 3.5.1 分层

| 文件 | 职责 |
| --- | --- |
| `todo-store.js` | 纯函数数据层：新建、规范化、增删改、移动、排序 |
| `todo-sidebar.jsx` | React 侧栏 UI：列表、分类、勾选、拖动排序 |
| `todo-store.test.mjs` | 数据层单元测试 |

### 3.5.2 数据模型

- 存储形态：**扁平数组 + `parent` 引用**，而非嵌套树。拖动只需改一个 `parent` + 重排 `order`，嵌套树则要递归查找/删除/插入三处
- 条目类型：`todo`（可勾选）与 `category`（分类）
- 顶层结构：`{version: STORAGE_VERSION, items: [...]}`
- `normalizeState()` 的容错原则：**坏数据只丢自己，绝不抛异常**（去重 id、丢弃非法条目、补默认值），避免畸形字段拖崩编辑器

### 3.5.3 持久化

待办随项目保存，落在 `project.json` 顶层字段 `hiwarpTodos`：

- 序列化 / 反序列化由 `patches/apply.mjs` 对依赖包内的 `node_modules/scratch-vm/src/serialization/sb3.js` 打补丁实现（照上游 `customFonts` 的样板）
- 其他编辑器（TurboWarp / Scratch）反序列化只读已知字段，会静默忽略该字段，因此不会崩、也不会显示

### 3.5.4 测试

```bash
node src-renderer-webpack/editor/gui/todo-store.test.mjs
```

测试脚本会先把 `todo-store.js` 拷成临时 `.mjs` 再动态导入——因为 `package.json` 没有 `"type": "module"`，Node 会把 `.js` 当 CommonJS 解析，直接 import 会报 `Unexpected token 'export'`。

## 3.6 扩展系统

扩展来源分三类：

| 来源 | 说明 | 生成方式 |
| --- | --- | --- |
| 官方扩展库 | `@turbowarp/extensions`（GitHub 依赖） | `npm run fetch` → `scripts/prepare-extensions.mjs` → `dist-extensions/*.br` |
| 扩展库索引与资源 | 供编辑器扩展库与离线文档使用 | `scripts/download-library-files.mjs` → `dist-library-files` |
| 第三方扩展（02Engine / PenguinMod / CCW / hidream） | 由 `patches/` 补进 `scratch-gui` / `scratch-vm` | `node patches/apply.mjs` |

`patches/` 中与扩展相关的部分包括：

- `patches/scratch-gui/src/lib/libraries/extensions/hidream/*`（6 个扩展的图标 png 与源码副本）；**面板条目默认不注册**——需要时用 `extracted/02engine-extensions/`（条目定义 `entries.jsx` + 图标 + 源码 + README）。`extensionURL` 必须与 `tw-default-extension-urls.js` 的映射逐字一致，否则同一扩展会被当成两个 id 加载两遍
- `patches/scratch-vm/src/extensions/*`（`file_plus`、`image_processor`、`netease_music`、`webgl_liquid_glass_v4`、`cyberexplorer_toolbox_mini`、`hidream_puw`）
- `patches/scratch-gui/static/extensions/ExtFind.js`、`patches/scratch-gui/static/penguinmod/extensions.js`
- CCW 扩展弹窗与扩展导入弹窗（`tw-ccw-extension-modal`、`tw-extension-import-modal`）

运行时通过 `tw-extensions://` 协议读取扩展脚本，优先返回 brotli 压缩版本；打包器会把用到的扩展内联进产物（`scripts/download-packager.mjs` 对官方 `src-renderer/packager/standalone.html` 打补丁，增加内置扩展 URL 映射表）。

### 3.6.1 加载项的默认启用表（HiWarp 自研）

上游把加载项的启用状态完全交给 `localStorage['tw:addons']`，而 82 个加载项里 `enabledByDefault` 为 `true` 的只有 21 个。这份存储一旦被清空（重装、换构建、清缓存、点「全部重置」），用户手工打开的插件就全部回到关闭状态——这就是「默认开启的插件总是没开」的根因。

HiWarp 在 `src-renderer-webpack/editor/addons/hiwarp-addon-defaults.js` 维护一张默认表（65 个 id），由 `gui/index.jsx` 作为**第一个 import** 引入，保证在加载项系统读取存储之前执行：

| 存储中的状态 | 处理 |
| --- | --- |
| 没有该加载项的 `enabled` 字段 | 补 `true` |
| 已有 `enabled: false`（用户手动关过） | 保持关闭，不覆盖 |
| 存储整体缺失 / JSON 损坏 | 重建为默认表 |
| 插件内部参数（如 `custom-block-shape` 的圆角/缺口） | 缺失的键补默认值，已有的不动 |

所以它是「默认值」而不是「强制值」。清单在本仓库源码里，不受 `npm ci` 影响；改完数组需重新 `npm run webpack:compile`。

插件内部参数由同文件的 `DEFAULT_ADDON_SETTINGS` 维护（当前只有 `custom-block-shape: {cornerSize: 300, notchSize: 0}`）。取值来源：2026-10-27 逐项对照「加载项设置」页的实际取值与各插件 `_manifest_entry.js` 的 `default`，40 个带参数的加载项里只有这一项与上游不同，其余不重复声明，避免和上游默认值产生两份真相。

实现要点：

- 存储键 `tw:addons`、版本号 `5` 必须与 `node_modules/scratch-gui/src/addons/settings-store.js` 的 `SETTINGS_KEY` / `VERSION` 保持一致
- `seedAddonDefaults()` 是纯函数（输入输出都是字符串），`applyAddonDefaults()` 只负责读写 `localStorage`，失败时静默返回 `false`，不能让存储问题拖崩编辑器
- npm 包里**没有** `addon.json`：`enabledByDefault` 实际写在每个插件生成的 `_manifest_entry.js` 里，所以「改插件源码默认值」等于改 `node_modules` 里 82 个生成文件，不推荐

> 历史：曾有一版把白名单硬编码进 `patches/` 对 `settings-store.js` 的补丁里并无条件覆盖 `enabled`，副作用是用户关不掉、且 `npm ci` 后补丁丢失就彻底失效。该补丁已移除（`patches/apply.mjs` 与上游一致）。

自测：`node src-renderer-webpack/editor/addons/hiwarp-addon-defaults.test.mjs`

## 3.7 打包器

- 页面：`src-renderer/packager/standalone.html`（由脚本下载并按 sha256 校验，再打 HiWarp 补丁）；窗口逻辑在 `src-main/windows/packager.js`，预览在 `src-main/windows/packager-preview.js`
- 7-Zip：`src-main/seven-zip.js`（依赖 `7zip-bin`）
- 项目导出前经过 `src-renderer-webpack/editor/gui/filesystem-api.js` 封装，受限模式下禁止导出

## 3.8 加密项目与受限模式

编辑器支持加密项目（`.hwp`）：

- 打开时通过 `hiwarpProjectEncryption` 判断是否加密并弹出解锁对话框
- 密码正确 → 正常加载；密码错误或取消 → 进入「受限模式」，按清单中的 `wrongCredentialPermissions` 限制能力（如禁止导出）
- 受限模式激活时，三个侧栏（AI、文本编程、待办）都会隐藏

实现位置（**已纳入版本控制**）：

| 部分 | 路径 |
| --- | --- |
| 加解密核心 | `patches/scratch-vm/src/util/hiwarp-project-encryption.js` |
| 加密弹窗 | `patches/scratch-gui/src/components/hiwarp-project-encryption-modal/` |
| 解锁弹窗 | `patches/scratch-gui/src/components/hiwarp-project-unlock-modal/` |
| 加密容器接线 | `patches/scratch-gui/src/containers/hiwarp-project-encryption-modal.jsx` |
| 解锁容器接线 | `patches/scratch-gui/src/containers/hiwarp-project-unlock-modal.jsx` |

## 3.9 其它窗口

| 窗口 | 主进程文件 | 页面 |
| --- | --- | --- |
| 编辑器 | `src-main/windows/editor.js` | `dist-renderer-webpack/editor/gui/gui.html` |
| AI 聊天 | `src-main/windows/ai-chat.js` | `src-renderer/ai-chat/index.html` |
| 关于 | `src-main/windows/about.js` | `src-renderer/about/about.html` |
| 桌面设置 | `src-main/windows/desktop-settings.js` | `src-renderer/desktop-settings/*` |
| 更新 | `src-main/windows/update.js` | `src-renderer/update/*` |
| 反馈 | `src-main/windows/feedback.js` | `src-renderer/feedback/*` |
| 隐私 | `src-main/windows/privacy.js` | `src-renderer/privacy/*` |
| 文件访问 | `src-main/windows/file-access-window.js` | `src-renderer/file-access/*` |
| 打包器 | `src-main/windows/packager.js` | `src-renderer/packager/*` |
| 数据迁移 | `src-main/windows/migrate.js` | `src-renderer/migrate/*` |
| 扩展文档 | `src-main/windows/extension-documentation.js` | 离线文档页 |

## 3.10 上游基础模块（HiWarp 沿用）

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| 日志 | `src-main/logging.js` | 按日期写入 `userData/logs/hiwarp-<date>.log`，渲染层通过 `logs:renderer` 汇聚；提供 `logs:get-info` / `logs:open-directory` |
| 崩溃与异常提示 | `src-main/crash-messages.js`、`src-main/entrypoint.js` | 未捕获异常与 Promise 拒绝时弹窗并记录日志 |
| 本地化 | `src-main/l10n/` | `src-main/l10n/en.json` + `src-main/l10n/generated-translations.json` |
| 更新检查 | `src-main/update-checker.js`、`src-main/windows/update.js` | 按设置中的策略检查新版本 |
| 加载项（Addons） | `src-renderer-webpack/editor/addons/` | 编辑器插件页面，与主界面分开打包 |
| 用户数据迁移 | `src-main/migrate.js`、`src-main/windows/migrate.js` | 旧版本数据结构升级与提示 |
| 文件系统 API | `src-renderer-webpack/editor/gui/filesystem-api.js` | 打开/保存/导出封装，受限模式下拦截导出 |
| 媒体权限 | `src-main/media-permissions.js`、`src-main/windows/security-prompt.js` | 摄像头、麦克风权限校验与提示 |
| 右键菜单 | `src-main/context-menu.js` | 编辑器上下文菜单 |
| 富存在（Rich Presence） | `src-main/rich-presence.js` | 可选的 Discord 状态同步 |
| 外部链接 | `src-main/open-external.js` | 统一在系统浏览器打开外链 |
| 反馈 | `src-main/windows/feedback.js` | 反馈窗口与信息收集 |

AI 助手另有两项语音相关能力：回复「朗读」使用渲染层的 `speechSynthesis`；语音输入通过 `ai:recognize-speech` 交给主进程。

## 3.11 Material Symbols 图标库（HiWarp 自研）

在「选择一个角色」对话框里增加三个风格标签（轮廓 / 圆角 / 尖锐），点图标即可把该图标作为新角色插入项目。数据来自 Apache-2.0 的离线包 `@material-symbols/svg-400`（v0.48.2，每个风格 3,937 个图标 × 描边/实心两态，共 23,622 个 SVG）。

### 3.11.1 分层

| 部分 | 位置 | 职责 |
| --- | --- | --- |
| 取数脚本 | `scripts/prepare-material-symbols.mjs` | 从依赖复制 SVG 到 `dist-library-files/material-symbols/`，生成 `index.json` 与 `LICENSE` |
| 协议 | `tw-library://`（已有） | 按文件返回 JSON / SVG，`cors: true`，支持子目录 |
| 逻辑模块 | `patches/scratch-gui/src/lib/hiwarp-material-symbols.js` | 清单/归档加载、条目构建（惰性 `rawURL`）、SVG 尺寸归一、插入角色 |
| 标签 | `patches/scratch-gui/src/lib/libraries/sprite-tags.js` | 追加三个标签（文案内联，不改 l10n 词条） |
| 容器 | `patches/scratch-gui/src/containers/sprite-library.jsx` | 把图标条目并入 `data`、处理填充切换与选中插入 |
| 库组件 | `patches/scratch-gui/src/components/library/library.jsx` | 筛选栏扩展控件槽位、分批渲染、`hiddenInAllTag` |

### 3.11.2 三个关键约束

1. **缩略图不能走 md5 路径**：上游 `library-item.jsx` 把 `iconURL` 写死成 `https://cdn.assets.scratch.mit.edu/internalapi/asset/<md5>/get/`。我们的图标不在 Scratch 素材服务器上，因此条目只给 `rawURL`（`tw-library://./material-symbols/...`），`iconMd5` 留空。
2. **插入必须让 `storage.load` 能找到资源**：`vm.addSprite` 走 `sb3` 反序列化时，`serialization/sb3.js` 会**重建**造型对象，只挑固定字段（`assetId`/`name`/`bitmapResolution`/旋转中心/`md5ext`/`dataFormat`），**造型上的内联 `asset` 会被丢掉**；随后 `import/load-costume.js` 通过 `storage.load(assetId)` 取素材，取不到就是坏造型（舞台上显示「?」）。
   因此插入流程是「取 SVG → 重写尺寸 → `storage.createAsset` → **把 asset 登记到 `iconAssets` 并给 storage 注册高优先级 helper** → `vm.addSprite`」，让 `storage.load` 直接在内存命中，不依赖素材服务器。
   **helper 的接口约定很容易写错**：`ScratchStorage.load()` 是 `if (loading === null) return tryNextHelper();`，只有**同步返回 `null`** 才算「没找到」。返回 `Promise.resolve(null)` 会被当成「找到了一个 null」，后面真正的 helper 再也不会被调用——表现为**全站造型损坏**（连普通角色都变成 `?`）。测试里专门锁了这一条。
3. **不能混进「所有」标签**：图标共 11,811 条，`selectedTag === 'all'` 时会把常规角色挤出视野，所以条目带 `hiddenInAllTag`，由库组件在「所有」下过滤掉。
4. **`.br` 探测不能抛**：`tw-library://` 开了 `brotli`，处理器会先试 `<file>.br`。`dist-library-files` 里其它资源都是 brotli 压缩的，而图标是**未压缩**的 SVG，`net.fetch` 找不到 `.br` 时会抛 `ERR_FILE_NOT_FOUND`（不是返回非 200），不接住就会变成整个请求失败（表现为渲染层收到 HTTP 400）。`src-main/protocols.js` 的探测已改为 try/catch 兜底。

### 3.11.3 性能处理

- **图标按风格归档，不铺散文件**：`dist-library-files/material-symbols` 只有 5 个文件（`outlined/rounded/sharp.json` + `index.json` + `LICENSE`）。早期版本是 23,622 个独立 `.svg`，12.7 MB 数据配 23,622 个 inode，导致 electron-builder 每次封装、WSL 每次 rsync 都退化成 inode 操作——归档后构建时间与图标数量脱钩。
- **归档惰性加载**：`<style>.json` 每个 4~6 MB，容器挂载后逐个加载，每完成一个就重建条目；条目的 `rawURL` 是**惰性 getter**，归档未就绪时返回透明占位图，就绪后自动变成 `data:image/svg+xml` 缩略图，避免打开面板时一次性解析十几 MB。
- 每套 3,937 条，库组件默认**分批渲染 400 条**（`RENDER_BATCH`），超出显示「加载更多」按钮；切换标签或搜索词时自动回到首批。
- 图标名称清单（`index.json`，约 177 KB）只取一次并缓存在容器实例上，不进 React state。
- 实心是归档里的 `<name>-fill` 键，切换填充只重建条目（重新挂 getter 闭包），不重新请求归档。

### 3.11.4 插入行为

- 原始 SVG 是 `viewBox="0 -960 960 960"`（图形画在**负 Y 区域**），所以不能只改 `width/height`：那样造型框是 100×100、墨迹却在框外，表现为「角色列表缩略图有图形、舞台上什么都没有」。插入时会先把原点归一到 `0 0`，内容整体用 `<g transform="translate(0 960)">` 平移回来，再把宽高改成 `MATERIAL_SYMBOL_STAGE_SIZE`（100）。
- SVG 必须转成**字节**（`TextEncoder`）再交给 `storage.createAsset`：矢量图渲染路径用 `TextDecoder.decode()` 处理素材，传字符串会抛 `parameter 1 is not of type 'ArrayBuffer'`，造型直接变坏（舞台上显示 `?`）。
- 角色放在舞台中心（0,0），旋转中心为造型中心（50,50），方向 90、缩放 100。
- 角色名取图标名（如 `home`），便于搜索与脚本引用。

自测：`node patches/scratch-gui/src/lib/hiwarp-material-symbols.test.mjs`

---

# 4. 构建、打包与发布

## 4.1 环境准备

| 依赖 | 用途 |
| --- | --- |
| Node.js + npm | 构建与依赖安装 |
| PowerShell | Windows 打包与安装脚本（`install.ps1`） |
| WSL（含 rsync） | 在 Windows 上构建 Linux 包（`SpeedScript/compile.bat`） |

> `package.json` 未声明 `engines`，实际以 `.github/workflows` 与本地脚本为准。

## 4.2 首次准备（关键步骤）

```bash
git clone --recursive <repo-url>
npm ci                  # 安装依赖（scratch-gui / scratch-vm 来自 GitHub）
node patches/apply.mjs  # 【必须】把 HiWarp 对 node_modules 的补丁应用回去
npm run fetch           # 拉取扩展库、扩展产物、打包器
```

### 为什么必须有 `patches/apply.mjs`

HiWarp 对 `scratch-gui` / `scratch-vm` 的改动曾经**只存在于 `node_modules` 里**。而 `node_modules` 被 `.gitignore` 忽略、`npm ci` 会整体重建依赖目录——等于这些源码没有版本控制。

2026-09-21 发生过一次事故：一次 `npm ci` 之后，34 个新增文件与 9 个上游文件的改动全部丢失，最后只能从残留的 `dist-web` source map 的 `sourcesContent` 里抢救回来。

现在这些改动全部存放在 `patches/` 并受 git 管理，克隆或升级依赖后执行 `node patches/apply.mjs` 即可恢复。

脚本特性（`patches/apply.mjs`）：

- **幂等**：每个字符串编辑带 marker，已应用则跳过
- **失败要吵**：锚点找不到或匹配到多处时记入 `problems`，最后以非 0 退出
- **纯字符串锚点**：不使用行号，对上游小改动免疫
- 分两类：`copyPackage()` 直接复制整文件补丁；另一类是带 marker 的查找/替换编辑

`npm run fetch` 依次执行：

1. `scripts/download-library-files.mjs` —— 扩展库资源
2. `scripts/download-packager.mjs` —— 打包器页面（sha256 校验 + HiWarp 补丁）
3. `scripts/prepare-extensions.mjs` —— 编译扩展并生成 brotli 产物
4. `scripts/prepare-material-symbols.mjs` —— Material Symbols 图标（约 12.7 MB / 23,622 个 SVG）

## 4.3 开发循环

```bash
npm run webpack:compile   # 编译渲染层（一次）
npm run webpack:watch     # 监听变化自动重编
npm run electron:start    # 启动应用
```

只改 `src-main`（无构建步骤）无需重新编译，重启应用即可；改 `src-renderer-webpack` 必须先编译。

## 4.4 生产构建

```bash
npm run webpack:prod
```

产物位于 `dist-renderer-webpack/`。打包前必须执行，否则产物内是旧界面。

## 4.5 Windows 打包

```bash
npx electron-builder --win nsis portable --x64 --config electron-builder.hiwarp-alpha.cjs --publish never
```

得到 `Setup`（NSIS 安装包）与 `Portable` 两种产物，命名由 `artifactName` 决定。

> 该模板内的版本号是写死的旧值，手动执行前需要先替换，或直接使用 `SpeedScript/compile.bat`（它会生成带正确版本号的临时配置）。

## 4.6 Linux 打包（经 WSL）

`SpeedScript/compile.bat <version>` 的流程：

1. 校验版本号（semver），拆出主版本与预发布段（`1.3.0-alpha.1` → `1.3.0` + `alpha.1`）
2. 检查 `node`、`npx`、`wsl`、`powershell`
3. 仓库路径转 WSL 路径，探测 WSL 用户并确定构建目录（`~/hiwarp-build`）
4. 用 PowerShell 基于模板生成带版本号的临时 electron-builder 配置
5. `npm run webpack:prod`
6. 构建 Windows 产物（nsis + portable）——electron-builder 在同一平台内**只生成一次 app 目录/asar**，两个 target 各自封装
7. `rsync` 同步源码到 WSL 内文件系统（排除 `node_modules`、`.git`、`dist` 等）——**必须在 ext4 内构建，扫描 `/mnt/c` 上的 `node_modules` 极慢**
8. 首次同步 `node_modules`（之后复用缓存）
9. 在 WSL 内执行 electron-builder 生成 `deb`、`AppImage`、`tar.gz`（同样只打包一次 app 目录）
10. 把 Linux 产物按统一命名复制回 Windows `dist/`
11. 清理临时配置与中间目录

脚本在每个阶段的边界打印 `[时间] ... %TIME%`，跑一次即可拿到各阶段真实耗时（`[1/4]`、`[2/4]`、`[3/4.1]`、`[3/4.3]`、`[4/4]`）。

镜像加速：脚本设置 `ELECTRON_MIRROR` 与 `ELECTRON_BUILDER_BINARIES_MIRROR` 指向 npmmirror。

## 4.7 Web 版

```bash
SpeedScript\build-web.bat <version>
```

流程：`webpack:prod` → 复制 `dist-renderer-webpack/editor/gui`（`gui.html` 重命名为 `index.html`）→ 复制 addons、扩展、扩展库 → 压缩为 `dist/HiWarp-web-<version>.zip`。

> Web 版是功能子集：依赖 Electron 的能力（免费 DeepSeek 通道、文件系统、打包器）不可用。

## 4.8 一键安装（.ggconfig）

`.ggconfig/download_parameters.json` 描述「下载源码 → 构建 → 安装」的自动化步骤：

| 平台 | 步骤概要 |
| --- | --- |
| Windows | 下载仓库 → `npm ci` → `npm run fetch` → `webpack:prod` → electron-builder 构建 NSIS → 静默运行 Setup（`/S`）→ 执行 `install.ps1` |
| Linux | 下载仓库 → `npm ci` → `npm run fetch` → `webpack:prod` → electron-builder 构建 deb / AppImage / tar.gz |
| macOS | 下载仓库 → `npm ci` → `npm run fetch` → `webpack:prod` → electron-builder 构建 dmg |

`install.ps1` 做三件事：定位安装目录（`%LOCALAPPDATA%\Programs\HiWarp*`）、补建开始菜单快捷方式、把安装目录加入用户 PATH。

> 注意：`.ggconfig` 流程目前**没有** `patches/apply.mjs` 这一步，与 4.2 的推荐流程不一致（见 6. 已知限制）。

## 4.9 版本号同步清单

版本号在多处出现，是最容易出错的一环：

| 位置 | 是否自动 | 说明 |
| --- | --- | --- |
| `package.json` 的 `version` | 手动 | 当前为 `2.0.2-alp.1`；`npm run electron:start`、electron-builder 默认读取此处 |
| `package.json` 的 `build.productName` / `appId` / `linux.executableName` | 手动 | 影响默认产物名与可执行文件名 |
| `electron-builder.hiwarp-alpha.cjs`（Windows） | 模板 + 替换 | 模板内仍写死 `1.2.2-alpha.1`，由 `SpeedScript/compile.bat` 生成临时配置时替换 |
| `electron-builder.hiwarp-linux-alpha.cjs` | 模板 + 替换 | 同上，另处理 `Linux-<core>-` 与预发布段 |
| `electron-builder.hiwarp-macos-alpha.cjs` | 手动 | 没有自动替换流程 |
| `SpeedScript/compile.bat` 参数 | 命令传入 | 例如 `compile.bat 2.0.2-alp.1` |

---

# 5. 版权与合规

## 5.1 上游

- 基于 TurboWarp Desktop（GPL-3.0），`LICENSE` 必须保留
- 部分代码来自 LLK/scratch-desktop
- 再发布必须保留版权与许可声明；源码分发仍需遵循 GPL-3.0

## 5.2 02Engine 代码声明

内置扩展相关文件搬运自 `https://github.com/02engine/desktop.git`，通过脚本统一添加声明：

```bash
node SpeedScript/add-copyright.js
```

脚本维护两份清单：

- `FULL_FILES`：完整搬运 → 「版权声明：来自 ...」
- `PARTIAL_FILES`：部分引用 → 「版权声明：部分代码来自 ...」

注释使用 `/*! ... */`，webpack production（terser）会保留；`.css` / `.svg` 使用各自注释语法。

> 现在补丁源文件已纳入 `patches/`，`npm ci` 后应先跑 `node patches/apply.mjs` 再跑本脚本。

## 5.2.1 随包分发的第三方库

独立 AI 聊天窗口是静态页面，无法 `import` node_modules，因此两份浏览器版库被**原样复制**进仓库（见 `src-renderer/ai-chat/vendor/README.md`）：

| 文件 | 版本 | 许可证 | 义务 |
| --- | --- | --- | --- |
| `vendor/markdown-it.min.js` | 14.1.0 | MIT | 保留文件头许可证声明 |
| `vendor/purify.min.js` | 3.4.5 | MPL-2.0 OR Apache-2.0 | 保留文件头许可证声明 |

两份文件均未修改；升级时按 `vendor/README.md` 的步骤重新复制并更新版本号。

Material Symbols 图标（见 3.11）也属于随包分发的第三方素材：

| 来源 | 版本 | 许可证 | 义务 |
| --- | --- | --- | --- |
| `@material-symbols/svg-400` | 0.48.2 | Apache-2.0 | 分发时附带 `LICENSE`（`prepare-material-symbols.mjs` 会自动复制到 `dist-library-files/material-symbols/LICENSE`） |

## 5.3 发布前检查

- [ ] `LICENSE` 存在且未被替换为其它许可
- [ ] `node patches/apply.mjs` 已执行（克隆或依赖升级后）
- [ ] `node SpeedScript/add-copyright.js` 已执行
- [ ] 版权声明在「设置 → 关于」中可见
- [ ] `package.json` 版本与构建参数一致
- [ ] 构建产物名符合 `HiWarp ... <version> ...` 规则
- [ ] 未把上游 `changelog.md` 写成 HiWarp 版本记录

---

# 6. 已知限制与风险

按影响程度排序：

1. **electron-builder 模板版本号仍写死**：Windows / Linux 模板内是 `1.2.2-alpha.1`，依赖 `SpeedScript/compile.bat` 字符串替换；macOS 模板没有自动替换，`package.json` 与模板可能不一致。
2. **`.ggconfig` 安装流程缺 `patches/apply.mjs`**：一键安装会 `npm ci` 但不应用补丁，可能得到一个缺少 HiWarp 扩展与加密功能的构建。
3. **补丁脚本未接入 npm scripts**：`patches/apply.mjs` 需要手动执行，没有任何自动化提醒（`npm ci` 后忘记执行就会踩 2026-09-21 那类坑）。
4. **DeepSeek 依赖网页 DOM**：`chat.deepseek.com` 改版会导致读取回复失败。
5. **AI 操作依赖模型遵守格式**：仍有给出错误 `targetId` 或非标准 JSON 的可能，因此保留审查 + 撤销两道兜底。
6. **.sp 语言能力有限**：仅覆盖常用积木，无反向转换、无真实造型/声音。
7. **测试覆盖薄**：只有 `todo-store.test.mjs` 与 `SpeedScript/scratch-text-test.js` 两个独立脚本，均未接入 `npm test`；AI 模块与 DeepSeek 通道没有自动化测试。
8. **Web 版功能子集**：AI 免费通道、文件系统、打包器在 Web 版不可用。
9. **RIIR 计划暂缓**：Rust 重写成果保存在分支 `riir-spike-tauri`（commit `b0e9deb`），master 保持 Node.js / Electron；细节见 `docs/RIIR-MILESTONES.md`。

---

# 7. 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 克隆 / `npm ci` 后：加密功能缺失、扩展库为空、编译报「模块找不到」 | 未应用 `patches/` | 执行 `node patches/apply.mjs`，确认退出码为 0 |
| `patches/apply.mjs` 报锚点找不到 | 上游 `scratch-gui` / `scratch-vm` 版本变动 | 输出会列出具体文件与 marker；核对上游代码后更新补丁锚点 |
| `Electron failed to install correctly, please delete node_modules/electron and try installing again` | Electron 二进制未下载完整 | 删除 `node_modules/electron` 后重装；可设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` |
| 启动报 `app.setName` undefined 之类错误 | 环境变量 `ELECTRON_RUN_AS_NODE=1` 让 Electron 以 Node 模式运行 | 清除该环境变量后重启 |
| `npm run electron:start` 显示版本号与预期不符 | `package.json` 的 `version` 未同步 | 按 4.9 同步 |
| 界面没有侧栏（AI / 文本编程 / 待办） | 渲染层未重新编译，或处于受限模式 | 执行 `npm run webpack:compile` 后重启；确认项目未进入受限模式 |
| 侧栏标签拖出后重启又归位 | 设计如此：浮动状态不持久化，只记住竖直位置 | 无需处理 |
| AI 操作报「目标不存在: &lt;id&gt;」 | 模型使用过期或臆造的角色 ID | 提示词与上下文已自动加固；仍失败时重试或改用自定义上下文指定目标 |
| DeepSeek 无法登录 / 读不到回复 | 登录态过期、网页改版、网络受限 | 先点「登录」完成验证；查日志中的 `deepseek-web` 记录；结构变化需更新选择器 |
| `SpeedScript/compile.bat` 在 WSL 阶段长时间无进展或反复输出 `cannot` | 首次同步 `node_modules` 较慢，或 rsync / 路径转换失败 | 关注 3/4.1~3/4.3 分步输出；确认 WSL 已装 `rsync`；查看 `~/hiwarp-build` 状态 |
| `.sp` 报「第 N 行无法识别」 | 语法或缩进错误 | 按 3.3.2 语法表核对；嵌套行必须比父行更深 |
| 待办清单数据丢失 | `.sb3` 未保存，或未应用 sb3 序列化补丁 | 确认 `node patches/apply.mjs` 已执行；待办随项目保存，需正常保存项目 |
| 日志在哪里 | `userData/logs` | 编辑器设置中的日志入口或 `logs:open-directory` IPC 可直接打开目录 |

---

# 附录 A：目录速查

| 路径 | 一句话说明 |
| --- | --- |
| `src-main/entrypoint.js` | 主进程入口（错误兜底） |
| `src-main/index.js` | 应用初始化与窗口编排 |
| `src-main/ai-service.js` | AI 服务端（提示词、模型、操作解析、会话） |
| `src-main/deepseek-free.js` / `src-main/deepseek-web.js` | 免费 DeepSeek 门面与内置实现 |
| `src-main/windows/editor.js` | 编辑器窗口与其 IPC |
| `src-preload/editor.js` | 编辑器渲染层可用的受控 API |
| `src-renderer-webpack/editor/gui/desktop-hoc.jsx` | 桌面版接线层（挂载三个侧栏与浮动标签栏） |
| `src-renderer-webpack/editor/gui/ai-sidebar.jsx` | AI 助手 UI 与操作执行器 |
| `src-renderer-webpack/editor/gui/todo-sidebar.jsx` / `todo-store.js` | 待办清单 UI 与数据层 |
| `src-renderer-webpack/editor/gui/dock-tabs.js` / `dockable-tab.jsx` / `dock-tabs-bar.jsx` | 侧栏停靠与浮动机制 |
| `src-renderer-webpack/editor/scratch-text/scratch-text.js` | .sp 语言核心 |
| `src-renderer-webpack/editor/scratch-text/sidebar.jsx` | .sp 面板 |
| `src-renderer-webpack/editor/addons/hiwarp-addon-defaults.js` | 加载项默认启用表（见 3.6.1）；`npm ci` 不会影响它 |
| `src-renderer/ai-chat/vendor/` | 独立 AI 窗口用的 Markdown 依赖（UMD 副本，见 3.1.10 / 5.2.1） |
| `patches/apply.mjs` | node_modules 补丁应用脚本 |
| `patches/scratch-gui/`、`patches/scratch-vm/` | 受版本控制的依赖补丁源 |
| `SpeedScript/compile.bat` | Windows + WSL 全平台打包脚本 |
| `SpeedScript/build-web.bat` | Web 版构建脚本 |
| `SpeedScript/add-copyright.js` | 02Engine 版权声明注入 |
| `.ggconfig/download_parameters.json` | 一键下单/构建/安装流程定义 |
| `install.ps1` | 安装后配置（快捷方式、PATH） |

# 附录 B：IPC 与协议速查

AI 相关 IPC 见 3.1.9；编辑器与其它能力：

| 通道 | 说明 |
| --- | --- |
| `open-ai-chat` | 打开 AI 聊天独立窗口 |
| `open-scratch-text-file` | 打开 .sp 文件对话框并读取内容 |
| `logs:renderer` | 渲染层日志写入主进程日志文件 |
| `logs:get-info` / `logs:open-directory` | 查询日志目录 / 打开日志目录 |
| `set-restricted-project-mode` | 同步受限模式状态 |

自定义协议清单见 2.3。

# 附录 C：常用命令

```bash
npm ci                                # 安装依赖
node patches/apply.mjs                # 应用 node_modules 补丁（npm ci 后必须）
npm run fetch                         # 拉取扩展、扩展库、打包器
npm run webpack:compile               # 编译渲染层（开发）
npm run webpack:watch                 # 监听编译
npm run webpack:prod                  # 生产编译
npm run electron:start                # 启动应用
node SpeedScript/add-copyright.js     # 恢复版权声明
node src-renderer-webpack/editor/gui/todo-store.test.mjs   # 待办数据层测试
node src-renderer-webpack/editor/addons/hiwarp-addon-defaults.test.mjs   # 加载项默认值测试
node src-renderer/ai-chat/markdown-vendor.test.mjs   # 独立 AI 窗口的 Markdown 接线自测
SpeedScript\compile.bat <version>     # 全平台打包（Windows + WSL Linux）
SpeedScript\build-web.bat <version>   # 构建 Web 版
```

---

# 文档与代码一致性

本文档基于以下方式编写，便于后续核对：

- 逐文件阅读了 `src-main`、`src-preload`、`src-renderer-webpack/editor` 的关键实现，并核对了 `patches/`、`SpeedScript/`、`.ggconfig/`
- 表格中的常量（默认配置、权限、超时、语法表、拖拽阈值、存储字段）均直接来自源码；修改源码后请同步更新本文档
- 文档中引用的仓库内路径已逐条做过存在性校验（构建产物名与运行时文件名除外）
- 当前工作区状态会导致部分验证无法进行：`node_modules` 与图形环境不一定可用，因此未执行构建/启动验证；如执行过 `npm ci`，请先跑 `node patches/apply.mjs` 再构建
