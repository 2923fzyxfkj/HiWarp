# HiWarp Desktop RIIR 里程碑与进度

> 用途：跟踪「把 HiWarp Desktop 用 Rust 重写」的范围、里程碑、验收标准与当前进度（RIIR = Rewrite It In Rust）
> 关联文档：`docs/TECHNICAL.md`（现状技术文档）
> 基线：`2.0.1-alp.1`（commit `93b1d62`）
> 最后更新：2026-09-21（RIIR 暂缓决定）

---

## ⚠️ 当前状态：RIIR 暂缓（2026-09-21 决定）

**master 已恢复为 Node.js / Electron 状态。** M1–M3 的实际成果保存在独立分支：

| 项 | 值 |
| --- | --- |
| 分支 | `riir-spike-tauri` |
| commit | `b0e9deb` |
| 内容 | 1776 行 Rust、49 条测试（全通过） |
| master 基线 | `93b1d62`（`2.0.1-alp.1`） |

**决定理由**：当前人力不足以承担完整重构。且评估后认为，对 HiWarp 而言 Tauri 的收益
主要是**安装包体积**（约 200MB → 约 10MB），代价是约 8 人月重写 + 测试矩阵从 1 个引擎
变 3 个引擎（Windows/WebView2 与 Electron 同为 Chromium，收益最小；Linux/macOS 才是
真正的引擎替换，而那里是风险而非收益）。

**将来重启时**：见 §7.6 决策记录。核心建议是**优先只做 M5（`.sp` 语言 → Rust crate）**，
不碰外壳。

---

## 0. 先读这段：轨道选择与结论

仓库内 JS 合计约 **16.3k 行**，但这**不是**要重写的主体。产品主体是 `scratch-gui`（GitHub 依赖）传递引入的 scratch-vm / scratch-render / scratch-svg-renderer / Blockly —— 纯 JS 生态，无 Rust 对应物。

据此拆成三条轨道：

| 轨道 | 范围 | 可行性 | 预估 | 决策 |
| --- | --- | --- | --- | --- |
| **A** | `.sp` 语言核心 → 独立 Rust crate + CLI | 🟢 | 3 人周 | **采纳**，同时作为 Track B 的首个可独立交付物 |
| **B** | Electron 外壳 → Tauri 2 + Rust core，编辑器继续作为 web 资产 | 🟡 | ≈8 人月 | **采纳**，主线 |
| **C** | scratch-gui / VM / Render / Blockly 也用 Rust 重写 | 🔴 | 人年计 | **排除** |

**排除 Track C 的理由**：等价于重新实现 Scratch 本身（`.sb3` 语义、扩展 ABI、积木行为位级兼容），且上游为 GPL-3.0，重写后仍须承担全部兼容义务。投入与收益严重倒挂。

### 状态图例

| 符号 | 含义 |
| --- | --- |
| ✅ | 已完成 |
| 🟨 | 进行中 |
| ⬜ | 未开始 |
| ⛔ | 阻塞 |
| ⏸ | 搁置 |

---

## 1. 范围

### 1.1 在范围内

- `src-main`（7,638 行）的绝大多数
- `src-preload`（366 行）的 API 形状重映射
- `src-renderer-webpack` 的自研部分：`scratch-text/scratch-text.js`（782 行）迁 Rust；`ai-sidebar.jsx`（1,653 行）保留 React，仅改通道
- `src-renderer` 静态页（保留 HTML，改由 Tauri 提供）
- `scripts/`（885 行）+ `SpeedScript/`（132 行）构建链

### 1.2 明确排除（继续使用 JS / 上游依赖）

- scratch-gui / scratch-vm / scratch-render / scratch-svg-renderer / Blockly
- `@turbowarp/extensions` 及第三方扩展的 JS 运行时
- 编辑器 UI 的 React 组件

### 1.3 不在本次范围

- 功能新增、UI 重设计（另立需求）

---

## 2. 技术选型对照

| 原实现 | Rust / Tauri 侧 | 备注 |
| --- | --- | --- |
| `BrowserWindow` | `tauri::WebviewWindow` | 窗口参数需逐项对齐（尺寸、sandbox、图标、背景色） |
| `registerBufferProtocol` / `registerFileProtocol` | `register_asynchronous_uri_scheme_protocol` | 12 个 `tw-*` 协议 |
| `contextBridge` + `ipcRenderer` | Tauri commands + capabilities | 权限模型不同，需按通道逐一设计 |
| `tw_config.json` | `serde_json` | **路径与格式必须完全兼容** |
| `safeStorage`（`ai-api-key.bin`） | `keyring` crate | 解密失败需退化为内存会话 |
| `7zip-bin` + child_process | `sevenz-rust` 或继续调用 7z 二进制 | 需评估压缩产物兼容性 |
| 主进程 `privilegedFetch` | `reqwest` | |
| `deepseek-web.js`（DOM 自动化） | webview + `eval` + 持久化 data dir | 脆弱度不降反升，见 R4 |
| brotli 扩展产物 | `brotli` crate | `tw-extensions` 优先返回 `.br` |
| 日志（`logging.js`） | `tracing` + `tracing-appender` | 文件路径与行格式保持一致 |

---

## 3. 里程碑

### M0 立项与基线冻结 ✅

- **目标**：冻结「当前状态」作为重写参照，消除版本号歧义
- **交付物**：`docs/TECHNICAL.md`（841 行）；版本号统一为 `2.0.1-alp.1`；误提交的 `electron-builder.hiwarp-*.tmp.cjs` 移出并忽略
- **DoD**：技术文档入库；版本号单一真源确认；基线 commit 可复现
- **产出结论**：
  1. `electron-builder.hiwarp-*-alpha.cjs` 内的 `1.2.2-alpha.1` 是 `compile.bat` **字面量替换的哨兵**，不可随版本号同步
  2. 版本比较大小写敏感，`Alp` / `alp` / `alpha` 是三个不同预发布版本

### M1 工具链与最小骨架 ⏸（分支 `riir-spike-tauri` 已实现）

- **目标**：证明 Tauri 2 能承载现有 webpack 产物
- **交付物**：`src-tauri/` 骨架；用 Tauri 窗口加载 `dist-renderer-webpack/editor/gui/gui.html`；三平台 WebView 冒烟
- **DoD**：Windows(WebView2) / macOS(WKWebView) / Linux(WebKitGTK) 均能打开编辑器首屏（积木可不工作）；输出《WebView 引擎差异清单》
- **依赖**：M0
- **预估**：1–2 人周
- **主要风险**：WebKitGTK 与 Chromium 的 API 差异 —— **这是 Track B 最大不确定项，必须先做 spike**

### M2 Rust core 基础层 ⏸（分支 `riir-spike-tauri` 已实现）

- **目标**：把无窗口依赖的基础设施先落成独立 crate
- **对应源码**：`brand.js`(13) `settings.js`(196) `logging.js`(198) `fetch.js`(50) `migrate.js`(176) `l10n/`
- **交付物**：`hiwarp-core` —— 品牌常量、`tw_config.json` 读写、日志（`userData/logs/hiwarp-<date>.log` + 渲染层日志汇聚）、privileged fetch、迁移
- **DoD**：用真实 `tw_config.json` 做双向读写测试；日志行格式与现版本逐行一致
- **依赖**：M1
- **预估**：2 人周

### M3 自定义协议层 ⏸（分支 `riir-spike-tauri` 已实现）

- **对应源码**：`protocols.js`（420 行，12 个协议）
- **交付物**：全部 `tw-*` 协议的异步 scheme 实现；统一安全响应头（禁止被扩展页面嵌入）；路径越界拒绝；`tw-extensions` 优先返回 `.br`
- **DoD**：逐协议与现版本做响应对比（状态码 / 响应头 / 正文）；越界用例全部拒绝；brotli 命中
- **依赖**：M2
- **预估**：2 人周

### M4 窗口体系与 IPC 桥 ⬜ ← 最大单块

- **对应源码**：`src-main/windows/` ≈2,602 行（含 `abstract.js` 399、`editor.js` 747）+ `src-preload` 366 行
- **交付物**：窗口工厂（editor / ai-chat / about / desktop-settings / update / feedback / privacy / file-access / packager / packager-preview / migrate / security-prompt / data-preview / project-running-window / addons / extension-documentation）；IPC 通道按清单逐条映射为 Tauri commands + capabilities；`web-preload-shim.js` 从 contextBridge 改为 Tauri API
- **DoD**：所有窗口可打开；IPC 通道清单全绿（含日志、媒体权限、受限模式、文件访问）
- **依赖**：M3
- **预估**：5–6 人周
- **主要风险**：capabilities 权限模型比 Electron sandbox 更细，逐通道设计工作量大；shim 改动会触碰 scratch-gui 接线层

### M5 `.sp` 语言 core 移植（Track A）⬜

- **对应源码**：`scratch-text/scratch-text.js`（782 行，`sidebar.jsx` 307 行保留 React）
- **交付物**：`hiwarp-sp` crate —— 解析 → AST → (a) Blockly XML (b) SB3 `project.json` + zip；CLI `sp2sb3` / `sp2xml`
- **DoD**：与 JS 版**对拍** —— 同一批 `.sp` 语料下 AST / XML / 项目 JSON 逐字段一致；错误含行号且语义一致；覆盖 SETTINGS / STATEMENTS / CONDITIONS / HATS 全表
- **依赖**：无（可脱离 Track B 独立交付）
- **预估**：3 人周
- **说明**：风险最低、最早见效，建议作为第一个动手的里程碑

### M6 AI 服务端移植 ⬜

- **对应源码**：`ai-service.js`（1,584 行）
- **交付物**：`hiwarp-ai` crate —— `DEFAULT_CONFIG` / `DEFAULT_PERMISSIONS`、提示词组装、上下文压缩、操作提取（JSON + XML 双格式）、VM/Target 方法白名单与 `ensureSafeArgs`、Blockly XML 注入检查、会话持久化、失败自动修正
- **DoD**：权限默认值与现版本逐项一致；20+ 操作类型全通；prompt 快照对比通过
- **依赖**：M2（设置 / 密钥存储）、M4（IPC）
- **预估**：4 人周
- **主要风险**：逻辑量大且**无自动化测试基线** → 建议先补最小回归集（见 M11）

### M7 免费 DeepSeek 通道 ⬜

- **对应源码**：`deepseek-free.js`(195) + `deepseek-web.js`(257)
- **交付物**：独立 webview 窗口 + 持久化 data dir（替代 `persist:deepseek-free`）+ 导航白名单（仅 `*.deepseek.com`）+ 注入脚本完成「写入输入框 → 触发发送 → 轮询最后一条回复」
- **DoD**：首次登录 → 发消息 → 取回回复闭环；超时与现版本一致（登录≈360s / 操作≈300s / 等待回复 180s）；窗口关闭即中断轮询
- **依赖**：M4
- **预估**：3 人周
- **主要风险**：仍依赖 `chat.deepseek.com` 的 DOM（继承既有脆弱点）；WebKitGTK 下注入与 localStorage 行为需实测

### M8 文件系统 / 打包器 / 压缩 ⬜

- **对应源码**：`windows/packager.js`(316) `packager-preview.js`(37) `seven-zip.js`(155) `filesystem-api.js`
- **交付物**：打开/保存/导出统一封装（含受限模式拦截）、7-Zip 压缩解压、打包器页面与预览、`standalone.html` 补丁流程
- **DoD**：导出产物与现版本等价；受限模式下导出被拒
- **依赖**：M4
- **预估**：3 人周

### M9 外围能力 ⬜

- **对应源码**：`rich-presence.js`(500) `migrate.js`(176) `update-checker.js`(71) `media-permissions.js`(41) `context-menu.js`(85) `security-prompt.js`(154) `crash-messages.js`(39) `entrypoint.js`(39)
- **交付物**：数据迁移、更新检查（保持 alpha 版 `isUpdateCheckerAllowed() === false` 的现有行为）、媒体权限与安全提示、右键菜单、Discord Rich Presence、崩溃兜底
- **DoD**：旧 `tw_config.json` / 用户数据可无损迁移；各能力行为与现版本一致
- **依赖**：M4
- **预估**：3 人周

### M10 发布链路与打包 ⬜

- **对应源码**：三个 electron-builder 模板 → Tauri bundler；`SpeedScript/compile.bat`、`build-web.bat`、`add-copyright.js`
- **交付物**：三平台产物（NSIS/MSI、dmg、deb/AppImage/rpm）；WSL 构建流程替换或退役；版权头注入保留（Node 或改 Rust）
- **DoD**：产物名符合 `HiWarp ... <version> ...` 规则；版本号单一真源；与现有产物做体积对比
- **依赖**：M4、M8
- **预估**：3 人周
- **前置阻塞**：`SpeedScript/` 当前被 `.gitignore` 忽略（0 个文件被跟踪）—— **必须优先入库**，否则重写时丢失参考实现

### M11 验收与灰度 ⬜

- **交付物**：双跑对照清单（同一批 `.sb3` / `.hwp` / `.sp` 语料在 Electron 版与 Tauri 版逐项比对）、性能基线（冷启动 / 内存 / 首屏）、灰度与回滚方案、回归测试集
- **DoD**：对照清单全绿；关键指标不劣于 Electron 版（劣化项须显式记录并接受）；回滚路径可用
- **依赖**：M5–M10
- **预估**：3–4 人周

### 依赖关系

```
M0 ─┬─ M1 ─ M2 ─┬─ M3 ─┬─ M4 ─┬─ M6
    │           │      │      ├─ M7
    │           │      │      ├─ M8 ─ M10 ─┐
    │           │      │      └─ M9 ───────┤
    └─ M5 ───────────────────────────────── ┴─ M11
```

---

## 4. 进度看板

| 里程碑 | 内容 | 状态 | 预估 | 依赖 | 可并行 |
| --- | --- | --- | --- | --- | --- |
| M0 | 立项与基线冻结 | ✅ | — | — | — |
| M1 | 工具链与最小骨架 | ⏸ 分支已实现；三平台冒烟待做 | 1–2 人周 | M0 | |
| M2 | Rust core 基础层 | ⏸ 分支已实现（19 测试） | 2 人周 | M1 | 与 M5 |
| M3 | 自定义协议层 | ⏸ 分支已实现（27 测试）；brotli 未接 | 2 人周 | M2 | 与 M5 |
| M4 | 窗口体系与 IPC 桥 | ⬜ | 5–6 人周 | M3 | 与 M5 |
| M5 | `.sp` 语言 core | ⬜ | 3 人周 | M0 | 与 M1–M4 |
| M6 | AI 服务端 | ⬜ | 4 人周 | M2, M4 | |
| M7 | 免费 DeepSeek 通道 | ⬜ | 3 人周 | M4 | 与 M8, M9 |
| M8 | 文件系统 / 打包器 | ⬜ | 3 人周 | M4 | 与 M7, M9 |
| M9 | 外围能力 | ⬜ | 3 人周 | M4 | 与 M7, M8 |
| M10 | 发布链路与打包 | ⬜ | 3 人周 | M8 | |
| M11 | 验收与灰度 | ⬜ | 3–4 人周 | M5–M10 | |

---

## 5. 工作量与假设

| 口径 | 结果 |
| --- | --- |
| 单开发者串行 | ≈34 人周 ≈ **8 人月** |
| 3 人并行（core+协议 / windows / `.sp`+AI 分线） | ≈12–14 周 ≈ **3 人月**（集成与双跑验收不可压缩） |

**假设**：

- 不含 Track C；不含功能新增；编辑器 UI 保持 React 不动
- 按「等价迁移」计，不追求性能优化
- **不含**过渡期 Electron 版与 Tauri 版的并行维护成本
- 若 M1 的 WebKitGTK spike 失败，Linux 需单独降级方案，工期与范围需重估

---

## 6. 风险登记册

| 编号 | 风险 | 等级 | 说明 | 缓解 |
| --- | --- | --- | --- | --- |
| R1 | WebKitGTK 兼容性 | 高 | Linux 侧 WebView 与 Chromium 行为差异，可能影响 scratch-render / 音频 / 注入 | M1 先做 spike，三平台冒烟后再决定是否继续 |
| R2 | `SpeedScript/` 未入库 | 高 | `.gitignore` 第 28 行忽略，0 文件被跟踪，含打包/Web/版权脚本 | 立即取消忽略并入库，或另建备份 |
| R3 | **加密项目实现不在本仓库** | 高 | `hiwarp-project-encryption` 位于 `node_modules`（scratch-vm 依赖）内，Tauri 侧无法直接复用 | 需在 Rust 重实现或保留 JS worker；**原作技术文档未覆盖此项成本** |
| R4 | DeepSeek 依赖网页 DOM | 中 | `chat.deepseek.com` 改版即失效 | 选择器集中管理；保留 Python 回退路径 |
| R5 | AI / DeepSeek 无测试基线 | 中 | 仅能人工验证，移植后难以证明等价 | 在 M6 之前补最小回归集 |
| R6 | 版本号多源 | 中 | 模板内 `1.2.2-alpha.1` 是替换哨兵；macOS 模板无自动替换 | 建立单一真源 + 校验脚本 |
| R7 | 双代码库并行维护 | 中 | 过渡期需同时修 Electron 版与 Rust 版 | 明确冻结策略与切换时点 |
| R8 | 第三方扩展 ABI | 中 | 02Engine / PenguinMod / CCW 扩展依赖 scratch-gui 运行时 | 保持编辑器为 web 资产即可规避 |

---

## 7. 待决 ADR

| 编号 | 决策点 | 说明 |
| --- | --- | --- |
| ADR-001 | 外壳：Tauri 2 vs 继续 Electron | 走 Track B 即选 Tauri 2 |
| ADR-002 | 编辑器资产交付 | 本地自定义协议 vs 打包进 tauri resources |
| ADR-003 | 密钥存储 | `keyring` vs 自实现加密文件 |
| ADR-004 | DeepSeek 通道 | webview 注入 vs 保留 Node 侧实现 |
| ADR-005 | 加密项目 | Rust 重实现 vs 保留 JS worker |
| ADR-006 | 构建脚本 | 编译为二进制 vs 保留 batch / Node 脚本 |

---

---

## 7.5 M1–M3 实施记录（2026-09-21）

> **注意**：本节描述的实现**已从 master 移除**，现在位于分支 `riir-spike-tauri`
> （commit `b0e9deb`）。本节保留为技术发现记录 —— 这些结论在将来重启重构时可以直接复用。

### 交付物

| 位置 | 内容 |
| --- | --- |
| `Cargo.toml` | 工作区（`exclude = ["src-tauri"]`，避免 WebView 依赖阻断 crates 构建） |
| `crates/hiwarp-core` | M2：品牌常量、路径布局、`tw_config.json` 设置读写、日志、原子写 |
| `crates/hiwarp-protocols` | M3：12 个 scheme 元数据表、安全响应头、MIME 映射、路径解析与越界防护 |
| `src-tauri` | M1：Tauri 2 骨架 + 协议接线；`SPIKE.md` 为待验证清单 |

### 验证结果

```
crates/hiwarp-core        19 tests passed
crates/hiwarp-protocols   27 tests passed
src-tauri                  3 tests passed   （含真实读取 gui.html 的端到端用例）
```

### 结论：环境风险重新评估

**⚠️ 早期版本曾把「无 MSVC `cl.exe`」列为阻塞项——那是误判。**
Visual Studio Professional 2026 装在 `O:\MVS\Program\...`，早期只查了 `C:\Program Files`
与 PATH，必然漏掉。`cc` / `find-msvc-tools` 通过注册表与 vswhere 定位 MSVC，不依赖 PATH。

实测（全部通过）：

| 探测 | 结果 |
| --- | --- |
| `tauri 2.11.6` + `wry 0.55.1` + `webview2-com 0.38.2` + `tao 0.35.3` 编译 | ✅ exit 0 |
| `brotli = "8"` `cargo check` | ✅ |
| `ring = "0.17"`（含汇编）`cargo check` | ✅ |
| `cc` crate 编译并链接真实 `hello.c` | ✅ 运行输出 `C function returned 42` |

**因此不存在 C 工具链阻塞**，`brotli` / `sha2` / `keyring` 均可使用——
M2 的 SHA-512 校验与 M3 的 brotli 解压**都已解除阻塞**。

真正的未验证项：**Linux(WebKitGTK) 与 macOS(WKWebView)**（本机是 Windows）。

### 本轮踩到并已规避的坑

1. **`Path::join` ≠ `path.join`**：Rust 的 `join` 遇到绝对路径会整体替换 base，JS 的
   `path.join` 只当相对片段拼接。若不先剥掉前导分隔符，`/etc/passwd` 会直接逃出协议根目录。
2. **`..` 越过根的处理**：Node 的 `path.normalize` 在根处**丢弃**多余的 `..`；最初的实现
   保留了字面量 `..`，导致合法请求被误判为越界（安全但不等价）。已按 Node 语义修正，
   并有测试固化。
3. **MIME 查表大小写敏感**：JS 的 `path.extname` 不归一大小写，`.PNG` 会查表失败。
   这是既有行为，已用测试固化，避免「顺手改进」引入不一致。
4. **百分号不解码**：`URL.pathname` 不解码，`%20` 会原样进入文件路径。已保留。
5. **`tauri-build` 要求 `bundle.icon` 指向真实存在的 `.ico`**，否则 Windows 资源文件生成
   失败。仓库已有 `build/icon.ico`（electron-builder 用的就是它），已复用。

### 与 JS 版的已知差异（M2/M3 待补）

| 项 | 说明 |
| --- | --- |
| SHA-512 完整性校验 | `atomic-write-stream.js` 在 `rename` 后校验内容哈希；Rust 端口未做（缺 `sha2`） |
| Windows `EPERM` 分支 | JS 会在 rename 报 `EPERM` 时校验哈希以判断是否实际成功；Rust 端口无法区分 |
| 日志 meta / 错误序列化 | `serializeError`、`meta` 对象、`patchConsole`、渲染层日志汇聚未实现 |
| brotli 解压 | `hiwarp-protocols` 只产出 `<file>.br` 候选；解压未接线 |
| 错误页 HTML | 未对齐 `createErrorPageHTML` |
| 动态类型语义 | JS 的 `data.locale = true` 会原样返回；Rust 端口按类型取值，类型不符退化为默认值 |

### 下一步

按依赖顺序，M1/M2/M3 的剩余收尾项：

- M1：三平台 WebView 冒烟（需 macOS / Linux 机器或 CI）
- M1：`resource_base()` 换成 Tauri `resource_dir()`，并声明 `bundle.resources`
- M2：接 `sha2` 补完整性校验（**已解除阻塞**）；补 meta / 错误序列化
- M3：接 `brotli` crate（**已验证可编译，解除阻塞**）；对齐错误页 HTML；确定 Electron 特权位到 Tauri 的映射
## 7.6 决策记录：为什么暂缓（2026-09-21）

### 结论

暂缓完整 RIIR，master 回到 Electron。技术成果转入 `riir-spike-tauri` 分支。

### 理由

| 维度 | 评估 |
| --- | --- |
| 收益 | 主要是**安装包体积**（Electron ≈150–250MB → Tauri ≈3–10MB + 系统 WebView2）；内存约省 100–200MB；安全模型更严 |
| Windows 上的收益 | **很小**：Tauri 用 WebView2，与 Electron 同为 Chromium，重头戏（8.4MB `index.js` + 90 chunk + WebGL 渲染）跑的还是同一引擎 |
| 代价 | 约 8 人月重写；测试矩阵 1 → 3 个引擎；切断 Node 生态（`contextBridge`/`safeStorage`/`session` 等全部重做） |
| 最大技术风险 | Linux WebKitGTK 与 macOS WKWebView 与 Chromium 的行为差异，scratch-render 的 WebGL 路径首当其冲 |

### 将来重启时的建议顺序

1. **只做 M5**（`.sp` 语言 → Rust crate）。3 人周，不碰外壳，能拿到大部分「用 Rust」的
   实际收益（可独立测试、可给 AI 复用、将来无论换不换外壳都用得上）。
2. 若确实要换外壳，**先做 M1 的三平台冒烟**，用 WebKitGTK 跑一次完整编辑器，
   确认 WebGL/音频/输入法都能用，再决定是否投入。
3. 在动手前明确验收指标（体积目标？内存目标？Linux 打包需求？），否则无法判断成败。

### 已排除的方案

- **egui**：即时模式 GUI，没有 HTML / WebGL / Blockly。用它等于重新发明 Scratch 的
  积木编辑器、造型编辑器与舞台。对任何 Scratch 系项目都不成立。

---

## 8. 变更记录

| 日期 | 变更 | 作者 |
| --- | --- | --- |
| 2026-09-21 | 初版：M0 完成，M1–M11 立项 | — |
| 2026-09-21 | M1–M3 开工：Rust 工作区 + hiwarp-core（19 测试）+ hiwarp-protocols（27 测试）+ src-tauri 骨架（3 测试），共 49 测试通过 | — |
| 2026-09-21 | **决定暂缓 RIIR**：master 恢复 Electron；成果移至分支 `riir-spike-tauri`（`b0e9deb`）；新增 §7.6 决策记录 | — |