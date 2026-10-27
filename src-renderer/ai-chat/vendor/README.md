# vendor/

独立 AI 聊天窗口（`src-renderer/ai-chat`）是**无构建**的静态页面，不能像编辑器那样
`import` node_modules，所以这里放了两份浏览器版（UMD）第三方库的副本。

| 文件 | 包 | 版本 | 许可证 | 来源 |
| --- | --- | --- | --- | --- |
| `markdown-it.min.js` | [markdown-it](https://github.com/markdown-it/markdown-it) | 14.1.0 | MIT | `node_modules/markdown-it/dist/markdown-it.min.js` |
| `purify.min.js` | [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.5 | MPL-2.0 OR Apache-2.0 | `node_modules/dompurify/dist/purify.min.js` |

- 全局名：`window.markdownit`（工厂函数）、`window.DOMPurify`
- 两份文件均原样复制，未做任何修改；文件头保留了各自的许可证声明
- `src-main/protocols.js` 里 `tw-ai-chat` 的 CSP 需要 `script-src 'self'`，否则这两份文件加载不到

## 升级步骤

```bash
npm ci                                  # 或 npm install <包名>@<版本>
copy node_modules/markdown-it/dist/markdown-it.min.js src-renderer/ai-chat/vendor/
copy node_modules/dompurify/dist/purify.min.js src-renderer/ai-chat/vendor/
node src-renderer/ai-chat/markdown-vendor.test.mjs
```

同时更新上表的版本号与 `docs/TECHNICAL.md` 里的记载。
