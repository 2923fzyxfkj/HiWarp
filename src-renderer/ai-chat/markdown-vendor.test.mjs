/**
 * 独立 AI 聊天窗口的 Markdown 渲染链路自测。
 *
 * 用法: node src-renderer/ai-chat/markdown-vendor.test.mjs
 *
 * 检查三件事：
 *   1. vendor 下的两份 UMD 库确实可用（markdown-it 能渲染、DOMPurify 是工厂函数）
 *   2. index.html 确实引用了它们、并且用到了 messageMarkdown 渲染分支
 *   3. protocols.js 里 tw-ai-chat 的 CSP 放开了 'self'（否则脚本会被浏览器拦掉）
 * 第 3 条最容易漏：CSP 拦脚本是静默失败的，页面上看不出来。
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const protocols = fs.readFileSync(path.join(root, 'src-main', 'protocols.js'), 'utf8');

let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) {
    pass++;
    console.log('  OK   ' + name);
  } else {
    fail++;
    console.log('  FAIL ' + name);
  }
};

console.log('=== 1. vendor 文件存在 ===');
{
  for (const file of ['markdown-it.min.js', 'purify.min.js']) {
    const full = path.join(here, 'vendor', file);
    ok(`${file} 存在且非空`, fs.existsSync(full) && fs.statSync(full).size > 1024);
  }
  ok('vendor/README.md 记录了来源与许可证', fs.readFileSync(path.join(here, 'vendor', 'README.md'), 'utf8').includes('MIT'));
}

console.log('=== 2. markdown-it 实际能渲染 ===');
{
  const markdownit = require(path.join(here, 'vendor', 'markdown-it.min.js'));
  ok('导出的是工厂函数', typeof markdownit === 'function');
  const md = markdownit({html: false, linkify: true, breaks: true});
  const cases = [
    ['**粗体**', '<strong>粗体</strong>'],
    ['*斜体*', '<em>斜体</em>'],
    ['***粗斜体***', '<em><strong>粗斜体</strong></em>'],
    ['# 标题', '<h1>标题</h1>'],
    ['- 列表项', '<li>列表项</li>'],
    ['`行内代码`', '<code>行内代码</code>'],
    ['```\ncode\n```', '<pre><code>code'],
    ['| a | b |\n| --- | --- |\n| 1 | 2 |', '<table>'],
    ['> 引用', '<blockquote>']
  ];
  for (const [input, expected] of cases) {
    ok(`${JSON.stringify(input)} -> ${expected}`, md.render(input).includes(expected));
  }
  // 和编辑器侧栏一致的两条行为
  ok('原始 HTML 被转义（html:false）', md.render('<script>x</script>').includes('&lt;script&gt;'));
  ok('不成对的 ** 不会被当成粗体', md.render('test**').trim() === '<p>test**</p>');
}

console.log('=== 3. 页面接线 ===');
{
  ok('引用了 vendor/markdown-it.min.js', html.includes('src="vendor/markdown-it.min.js"'));
  ok('引用了 vendor/purify.min.js', html.includes('src="vendor/purify.min.js"'));
  ok('两个 script 在渲染函数之前', html.indexOf('vendor/markdown-it.min.js') < html.indexOf('const renderMarkdown'));
  ok('有 renderMarkdown 函数', html.includes('const renderMarkdown = content =>'));
  ok('渲染前经过 DOMPurify', html.includes('sanitizer.sanitize('));
  ok('DOMPurify 必须真的是带 sanitize 的实例', html.includes("typeof window.DOMPurify.sanitize === 'function'"));
  ok('AI 消息走 messageMarkdown 分支', html.includes("content.className = 'messageMarkdown'"));
  ok('库缺失时回退纯文本', html.includes('// vendor 库没加载起来时退回纯文本'));
  ok('用户消息仍是纯文本', html.includes("content.className = 'messageText'"));
  ok('链接在新窗口打开', html.includes("tokens[idx].attrSet('target', '_blank')"));
  ok('样式里有 messageMarkdown 规则', html.includes('.messageMarkdown pre'));
}

console.log('=== 4. 协议与 CSP 允许加载本地脚本 ===');
{
  const block = protocols.slice(protocols.indexOf("'tw-ai-chat'"), protocols.indexOf("'tw-ai-chat'") + 600);
  // 这条是踩过的坑：tw-ai-chat 曾经不是 standard scheme，源是不透明源，
  // CSP 里写 'self' 也永远匹配不上，vendor 脚本被静默拦截（只在日志里报错）。
  ok('tw-ai-chat 注册为 standard scheme', /standard:\s*true/.test(block));
  ok("script-src 含 'self'", /script-src[^;]*'self'/.test(block));
  ok('script-src 含 scheme 源 tw-ai-chat:（双保险）', /script-src[^;]*tw-ai-chat:/.test(block));
  ok('仍然禁止外部默认源', block.includes("default-src 'none'"));
}

console.log(`\n通过 ${pass}，失败 ${fail}`);
if (fail > 0) {
  process.exit(1);
}
