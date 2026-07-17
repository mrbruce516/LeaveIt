# 博文代码块 / 行内代码 / 引用块现代化改造 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Hugo Chroma 服务端染色替换已归档的 Google Code Prettify，给代码块/行内代码/引用块做 Catppuccin 双主题现代化样式，加 hover 复制按钮，全部改动收敛在 `themes/LeaveIt` submodule 内、主仓库 `config.toml` 零改动。

**Architecture:** 主题新增 `render-codeblock.html` render hook 接管代码块渲染，调 Hugo 内置 `highlight` 函数生成 Chroma 语义 class 输出（`noClasses=false`），选项经函数第三参数传入不依赖主仓库配置。CSS 用 Catppuccin Latte（浅）默认 + `.dark-theme` Mocha（深）覆写，4 个紫色 keyword token 换皮肤蓝。复制按钮由 jQuery 注入逻辑绑定。

**Tech Stack:** Hugo v0.133.0+extended（Chroma 内置、render hook）、SCSS（Hugo Pipes）、jQuery（已在用）。无新增依赖。

**设计文档:** `docs/superpowers/specs/2026-07-17-code-block-modernize-design.md`

## Global Constraints

- **范围**：所有改动仅限 `themes/LeaveIt` submodule，主仓库 `config.toml` 不动（验证标准 7）。
- **Hugo 版本**：本地 `hugo v0.133.0+extended`（`/usr/local/bin/hugo`），需 extended（SCSS 编译）。
- **配色常量**：浅色点缀蓝 `#2d96bd`、深色点缀蓝 `#63b8fd`，全文统一，勿引入其他蓝。
- **代码块 token 基底**：Catppuccin Latte（浅）/ Mocha（深），仅 `.k`/`.kr`/`.kp`/`.nt` 四个 token 用皮肤蓝替换紫色，其余 token 原样保留。
- **不重命名** `_prettyprint/default.scss`，仅替换内容（避免改 `main.scss` 的 `@import`）。
- **主题切换机制**：复用现有 `body.dark-theme`，深色样式一律用 `.dark-theme &` 或 `.dark-theme ` 前缀，不改主题切换 JS。
- **Git 纪律**：commit message 用中文，每任务结束 commit。不自动 push（边界规定）。删除文件需确认（`prettify.min.js` 已在 spec 确认可删）。
- **不动外部网络/服务**：不启动 dev server 自动化（给出命令由用户手动跑）；本地构建验证允许。
- **预览命令**（验证用，需用户手动执行）：
  - 主题预览：`cd exampleSite && hugo server -D --themesDir ../..`
  - 生产构建：`HUGO_ENV=production hugo --gc --minify`

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `layouts/_default/_markup/render-codeblock.html` | 新增 | 主题接管代码块渲染，生成 Chroma 语义 class + `.chroma-wrapper` + 复制按钮 |
| `assets/css/_common/_prettyprint/default.scss` | 替换内容 | Chroma 双主题 token 配色（Catppuccin Latte/Mocha，4 紫换蓝） |
| `assets/js/main.js` | 修改 | 删 `_Blog.prettify()`，加 `_Blog.copyCode()` |
| `assets/js/prettify.min.js` | 删除 | Prettify 引擎，不再被引用 |
| `layouts/partials/js.html` | 修改 | 从 bundle 移除 prettify |
| `assets/css/_common/_page/post.scss` | 修改 | 行内 `code:not([class])` 柔色胶囊 |
| `assets/css/_common/_core/base.scss` | 修改 | blockquote 主题色竖条 |

依赖顺序：Task 1（render hook 产 HTML 结构）→ Task 2（移除 Prettify）→ Task 3（Chroma 配色）→ Task 4（外框/复制按钮）→ Task 5（行内代码）→ Task 6（引用块）→ Task 7（终验）。

---

### Task 1: render hook 接管代码块渲染

**Files:**
- Create: `layouts/_default/_markup/render-codeblock.html`

**Interfaces:**
- Consumes: Hugo 内置 `highlight` 函数、render-codeblock 上下文（`.Inner` 代码内容、`.Type` 语言）
- Produces: 每个围栏代码块渲染为 `<div class="chroma-wrapper" data-lang="LANG"><button class="copy-code-btn">复制</button><div class="highlight"><pre class="chroma"><code class="language-LANG">...语义class...</code></pre></div></div>`。后续 Task 3/4 的 CSS、Task 2/4 的 JS 依赖此结构。

**说明：** 此任务无单元测试（Hugo 模板），验证靠构建后看输出 HTML。已用 Hugo 0.133 实测：hook 文件名必须为 `render-codeblock.html`（非 `render-code.html`），代码内容字段为 `.Inner`（非 `.Code`）。

- [ ] **Step 1: 创建 render hook 文件**

写入 `layouts/_default/_markup/render-codeblock.html`：

```html
{{- /* 主题接管代码块渲染：Chroma 服务端染色，选项经 highlight 函数第三参数传入，不依赖主仓库 [markup.highlight] 配置 */ -}}
{{- $lang := .Type | default "text" -}}
{{- $result := highlight .Inner $lang "lineNos=true, noClasses=false, lineNumbersInTable=false" -}}
<div class="chroma-wrapper" data-lang="{{ $lang }}">
  <button class="copy-code-btn" type="button" aria-label="复制代码">复制</button>
  {{- $result -}}
</div>
```

- [ ] **Step 2: 构建验证 hook 触发与输出结构**

Run:
```bash
cd exampleSite && /usr/local/bin/hugo --themesDir ../.. --quiet 2>&1 | grep -i error | head
```
Expected: 无 error 输出。

然后检查任一带代码块的文章输出（exampleSite 下）：
```bash
grep -l 'chroma-wrapper' /Users/bruce/Developer/blog/themes/LeaveIt/exampleSite/public/**/*.html 2>/dev/null | head -1
```
找到文件后查看其中一处代码块：
```bash
grep -o 'chroma-wrapper" data-lang="[a-z]*"\|class="chroma"\|class="k"\|class="ln"\|prettyprint' <上面找到的文件> | sort | uniq -c
```
Expected: 出现 `chroma-wrapper`、`class="chroma"`、`class="k"`、`class="ln"`；**无** `prettyprint`（此时 Prettify JS 仍会被 main.js 注入 class，但构建产物 HTML 里 Hugo 已不经 Prettify——若仍见 prettyprint 属 Task 2 范围，本步只确认 hook 产出了 chroma 结构）。

> 注：此阶段 `main.js` 的 `_Blog.prettify()` 仍存在，会在浏览器端给 `pre` 加 `prettyprint` class 覆盖 Chroma。**本步只验证 Hugo 构建产出的 HTML 源码含 chroma 结构**（grep 构建产物静态 HTML），浏览器运行时行为留待 Task 2 移除 Prettify 后验证。

- [ ] **Step 3: Commit**

```bash
git add layouts/_default/_markup/render-codeblock.html
git commit -m "新增 render-codeblock.html：Chroma 接管代码块渲染

主题侧 render hook 调用 Hugo highlight 函数生成语义 class，主仓库 config.toml 无需改动。"
```

---

### Task 2: 移除 Prettify

**Files:**
- Modify: `layouts/partials/js.html:5,15,18`
- Modify: `assets/js/main.js:7-10,51`
- Delete: `assets/js/prettify.min.js`

**Interfaces:**
- Consumes: Task 1 的 Chroma 输出结构（不再需要 Prettify 染色）
- Produces: JS bundle 不再含 prettify；浏览器不再给 `pre` 加 `prettyprint` class。`main.js` 暴露 `_Blog.copyCode()`（Task 4 实现，本任务先删 prettify、加占位调用）。

**说明：** Prettify 与 Chroma 不可并存，本任务彻底移除 Prettify 的 JS 引擎和注入逻辑。

- [ ] **Step 1: 从 js.html 移除 prettify 引用**

`layouts/partials/js.html` 第 5 行删除：
```
{{ $prettify := resources.Get "/js/prettify.min.js" }}
```

第 15 行（vendor_gallery bundle）：
```
{{ $vendorscript := slice $jquery $lazysizes $prettify $dynamic $main $lihtGallery $custom $lihtGallery_init | resources.Concat "/js/vendor_gallery.js" | resources.Minify }} 
```
改为（去掉 `$prettify`）：
```
{{ $vendorscript := slice $jquery $lazysizes $dynamic $main $lihtGallery $custom $lihtGallery_init | resources.Concat "/js/vendor_gallery.js" | resources.Minify }} 
```

第 18 行（vendor_no_gallery bundle）：
```
{{ $vendorscript := slice $jquery $prettify $dynamic $custom $main | resources.Concat "/js/vendor_no_gallery.js" | resources.Minify }}
```
改为（去掉 `$prettify`）：
```
{{ $vendorscript := slice $jquery $dynamic $custom $main | resources.Concat "/js/vendor_no_gallery.js" | resources.Minify }}
```

`vendor_main`（第 23 行）本不含 prettify，不动。

- [ ] **Step 2: 从 main.js 删除 prettify 注入逻辑**

`assets/js/main.js` 第 7-10 行删除：
```js
    _Blog.prettify = function() {
        $('pre').addClass('prettyprint linenums').attr('style', 'overflow:auto;');
        window.prettyPrint && prettyPrint();
    };
```

第 51 行（`$(document).ready` 内）删除：
```js
        _Blog.prettify()
```

> 注：删除 `_Blog.prettify()` 调用后，`$(document).ready` 块保留其余三行（`_Blog.changeTitle()`、`_Blog.toggleTheme()`、`_Blog.toggleMobileMenu()`）。Task 4 会在此块加 `_Blog.copyCode()`。

- [ ] **Step 3: 验证 main.js 语法完整**

Run:
```bash
node --check assets/js/main.js && echo "SYNTAX OK"
```
Expected: `SYNTAX OK`（main.js 无语法错误）。

- [ ] **Step 4: 删除 prettify.min.js**

```bash
git rm assets/js/prettify.min.js
```
（`git rm` 同时从工作区和暂存区删除。已确认可删。）

- [ ] **Step 5: 构建验证 bundle 不含 prettify、HTML 无 prettyprint**

Run:
```bash
cd exampleSite && /usr/local/bin/hugo --themesDir ../.. --quiet 2>&1 | grep -i error | head
```
Expected: 无 error。

检查产出 JS bundle 不含 prettify 代码：
```bash
grep -l "prettyPrint" exampleSite/public/js/*.js 2>/dev/null
```
Expected: 无输出（没有 bundle 含 prettyPrint）。

检查产出 HTML 无 prettyprint class（构建产物静态 HTML，非浏览器运行时）：
```bash
grep -rl 'prettyprint' exampleSite/public/ 2>/dev/null | head
```
Expected: 无输出。

- [ ] **Step 6: Commit**

```bash
git add layouts/partials/js.html assets/js/main.js assets/js/prettify.min.js
git commit -m "移除 Prettify 高亮引擎

从 JS bundle 与 main.js 删除 prettify 引用与注入逻辑，删除 prettify.min.js，由 Chroma 接管代码块染色。"
```

---

### Task 3: Chroma 双主题 token 配色

**Files:**
- Modify: `assets/css/_common/_prettyprint/default.scss`（整文件替换内容，不改文件名）

**Interfaces:**
- Consumes: Task 1 产出的 `.chroma .xx` 语义 class 结构、`.dark-theme` 切换机制
- Produces: 代码块 token 明暗配色。浅色 Catppuccin Latte 默认、深色 Mocha 经 `.dark-theme` 覆写。`.k`/`.kr`/`.kp`/`.nt` 用皮肤蓝。

**说明：** 配色源 `catppuccin/chroma` 官方 `dist/latte-chroma-style.css` 与 `dist/mocha-chroma-style.css`。两份的 `background-color` 去除（由 Task 4 的 `.chroma-wrapper` 控制背景）。紫色 4 token 换蓝。

- [ ] **Step 1: 用完整 Chroma 双主题样式替换 default.scss 内容**

将 `assets/css/_common/_prettyprint/default.scss` 全文替换为：

```scss
// ==============================
// Chroma 语法高亮配色（Catppuccin Latte 浅 / Mocha 深）
// 来源：catppuccin/chroma 官方 dist/*-chroma-style.css
// 紫色 keyword token（.k/.kr/.kp/.nt）替换为皮肤蓝：
//   浅色 #2d96bd（$light-post-link-color）、深色 #63b8fd（TOC 激活色）
// background-color 去除，改由 .chroma-wrapper 统一控制背景
// ==============================

// --- Latte（浅色，默认）---
.chroma {
  color: #4c4f69;
}
.chroma .x { color: #4c4f69; }
.chroma .err { color: #d20f39; }
.chroma .lnlinks { outline: none; text-decoration: none; color: inherit; }
.chroma .lntd { vertical-align: top; padding: 0; margin: 0; border: 0; }
.chroma .lntable { border-spacing: 0; padding: 0; margin: 0; border: 0; }
.chroma .hl { color: #4c4f69; }
.chroma .lnt { white-space: pre; user-select: none; margin-right: 0.4em; padding: 0 0.4em 0 0.4em; color: #8c8fa1; }
.chroma .ln { white-space: pre; user-select: none; margin-right: 0.4em; padding: 0 0.4em 0 0.4em; color: #8c8fa1; }
.chroma .k { color: #2d96bd; }       /* 关键字：紫 → 皮肤蓝 */
.chroma .kc { color: #fe640b; }
.chroma .kd { color: #8839ef; }
.chroma .kn { color: #d20f39; }
.chroma .kp { color: #2d96bd; }       /* 关键字占位：紫 → 皮肤蓝 */
.chroma .kr { color: #2d96bd; }       /* 保留字：紫 → 皮肤蓝 */
.chroma .kt { color: #df8e1d; }
.chroma .n { color: #4c4f69; }
.chroma .na { color: #1e66f5; }
.chroma .nb { color: #fe640b; }
.chroma .bp { color: #fe640b; }
.chroma .nc { color: #df8e1d; }
.chroma .no { color: #d20f39; }
.chroma .nd { color: #1e66f5; }
.chroma .ni { color: #ea76cb; }
.chroma .ne { color: #df8e1d; }
.chroma .nf { color: #1e66f5; }
.chroma .fm { color: #1e66f5; }
.chroma .nl { color: #04a5e5; }
.chroma .nn { color: #df8e1d; }
.chroma .nx { color: #4c4f69; }
.chroma .py { color: #fe640b; }
.chroma .nt { color: #2d96bd; }       /* 标签名：紫 → 皮肤蓝 */
.chroma .nv { color: #e64553; }
.chroma .vc { color: #e64553; }
.chroma .vg { color: #e64553; }
.chroma .vi { color: #e64553; }
.chroma .vm { color: #fe640b; }
.chroma .l { color: #4c4f69; }
.chroma .ld { color: #40a02b; }
.chroma .s { color: #40a02b; }
.chroma .sa { color: #d20f39; }
.chroma .sb { color: #40a02b; }
.chroma .sc { color: #40a02b; }
.chroma .dl { color: #1e66f5; }
.chroma .sd { color: #6c6f85; }
.chroma .s2 { color: #40a02b; }
.chroma .se { color: #1e66f5; }
.chroma .sh { color: #40a02b; }
.chroma .s1 { color: #40a02b; }
.chroma .ss { color: #40a02b; }
.chroma .m { color: #fe640b; }
.chroma .mb { color: #fe640b; }
.chroma .mf { color: #fe640b; }
.chroma .mh { color: #fe640b; }
.chroma .mi { color: #fe640b; }
.chroma .il { color: #fe640b; }
.chroma .mo { color: #fe640b; }
.chroma .o { color: #04a5e5; }
.chroma .ow { color: #04a5e5; }
.chroma .p { color: #7287fd; }
.chroma .c { color: #9ca0b0; font-style: italic; }
.chroma .ch { color: #9ca0b0; font-style: italic; }
.chroma .cm { color: #9ca0b0; font-style: italic; }
.chroma .c1 { color: #9ca0b0; font-style: italic; }
.chroma .cs { color: #9ca0b0; font-style: italic; }
.chroma .cp { color: #9ca0b0; font-style: italic; }
.chroma .cpf { color: #1e66f5; font-style: italic; }
.chroma .gd { color: #d20f39; }
.chroma .ge { font-style: italic; }
.chroma .gr { color: #d20f39; }
.chroma .gh { color: #fe640b; }
.chroma .gi { color: #40a02b; }
.chroma .go { color: #4c4f69; }
.chroma .gp { color: #9ca0b0; }
.chroma .gs { font-weight: bold; }
.chroma .gu { color: #fe640b; }
.chroma .gt { color: #d20f39; }
.chroma .gl { text-decoration: underline; }
.chroma .w { color: #6c6f85; }

// --- Mocha（深色，.dark-theme 覆写）---
.dark-theme {
  .chroma { color: #cdd6f4; }
  .chroma .x { color: #cdd6f4; }
  .chroma .err { color: #f38ba8; }
  .chroma .lnlinks { outline: none; text-decoration: none; color: inherit; }
  .chroma .lntd { vertical-align: top; padding: 0; margin: 0; border: 0; }
  .chroma .lntable { border-spacing: 0; padding: 0; margin: 0; border: 0; }
  .chroma .hl { color: #cdd6f4; }
  .chroma .lnt { white-space: pre; user-select: none; margin-right: 0.4em; padding: 0 0.4em 0 0.4em; color: #7f849c; }
  .chroma .ln { white-space: pre; user-select: none; margin-right: 0.4em; padding: 0 0.4em 0 0.4em; color: #7f849c; }
  .chroma .k { color: #63b8fd; }       /* 关键字：紫 → 皮肤蓝 */
  .chroma .kc { color: #fab387; }
  .chroma .kd { color: #cba6f7; }
  .chroma .kn { color: #f38ba8; }
  .chroma .kp { color: #63b8fd; }       /* 关键字占位：紫 → 皮肤蓝 */
  .chroma .kr { color: #63b8fd; }       /* 保留字：紫 → 皮肤蓝 */
  .chroma .kt { color: #f9e2af; }
  .chroma .n { color: #cdd6f4; }
  .chroma .na { color: #89b4fa; }
  .chroma .nb { color: #fab387; }
  .chroma .bp { color: #fab387; }
  .chroma .nc { color: #f9e2af; }
  .chroma .no { color: #f38ba8; }
  .chroma .nd { color: #89b4fa; }
  .chroma .ni { color: #f5c2e7; }
  .chroma .ne { color: #f9e2af; }
  .chroma .nf { color: #89b4fa; }
  .chroma .fm { color: #89b4fa; }
  .chroma .nl { color: #89dceb; }
  .chroma .nn { color: #f9e2af; }
  .chroma .nx { color: #cdd6f4; }
  .chroma .py { color: #fab387; }
  .chroma .nt { color: #63b8fd; }       /* 标签名：紫 → 皮肤蓝 */
  .chroma .nv { color: #eba0ac; }
  .chroma .vc { color: #eba0ac; }
  .chroma .vg { color: #eba0ac; }
  .chroma .vi { color: #eba0ac; }
  .chroma .vm { color: #fab387; }
  .chroma .l { color: #cdd6f4; }
  .chroma .ld { color: #a6e3a1; }
  .chroma .s { color: #a6e3a1; }
  .chroma .sa { color: #f38ba8; }
  .chroma .sb { color: #a6e3a1; }
  .chroma .sc { color: #a6e3a1; }
  .chroma .dl { color: #89b4fa; }
  .chroma .sd { color: #7f849c; }
  .chroma .s2 { color: #a6e3a1; }
  .chroma .se { color: #89b4fa; }
  .chroma .sh { color: #a6e3a1; }
  .chroma .s1 { color: #a6e3a1; }
  .chroma .ss { color: #a6e3a1; }
  .chroma .m { color: #fab387; }
  .chroma .mb { color: #fab387; }
  .chroma .mf { color: #fab387; }
  .chroma .mh { color: #fab387; }
  .chroma .mi { color: #fab387; }
  .chroma .il { color: #fab387; }
  .chroma .mo { color: #fab387; }
  .chroma .o { color: #89dceb; }
  .chroma .ow { color: #89dceb; }
  .chroma .p { color: #94e2d5; }
  .chroma .c { color: #6c7086; font-style: italic; }
  .chroma .ch { color: #6c7086; font-style: italic; }
  .chroma .cm { color: #6c7086; font-style: italic; }
  .chroma .c1 { color: #6c7086; font-style: italic; }
  .chroma .cs { color: #6c7086; font-style: italic; }
  .chroma .cp { color: #6c7086; font-style: italic; }
  .chroma .cpf { color: #89b4fa; font-style: italic; }
  .chroma .gd { color: #f38ba8; }
  .chroma .ge { font-style: italic; }
  .chroma .gr { color: #f38ba8; }
  .chroma .gh { color: #fab387; }
  .chroma .gi { color: #a6e3a1; }
  .chroma .go { color: #cdd6f4; }
  .chroma .gp { color: #6c7086; }
  .chroma .gs { font-weight: bold; }
  .chroma .gu { color: #fab387; }
  .chroma .gt { color: #f38ba8; }
  .chroma .gl { text-decoration: underline; }
  .chroma .w { color: #7f849c; }
}
```

> 说明：`.kd`（声明关键字，如 `var`/`class`）保留 Catppuccin 紫（`#8839ef`/`#cba6f7`）未换蓝——spec 只指定 `.k`/`.kr`/`.kp`/`.nt` 四个换蓝。若实际看效果希望 `.kd` 也换蓝，可在后续微调，本任务严格按 spec 4 token。

- [ ] **Step 2: 构建 SCSS 编译验证**

Run:
```bash
cd exampleSite && /usr/local/bin/hugo --themesDir ../.. --quiet 2>&1 | grep -iE "error|scss|sass" | head
```
Expected: 无 error/scss/sass 报错（SCSS 编译通过）。

- [ ] **Step 3: Commit**

```bash
git add assets/css/_common/_prettyprint/default.scss
git commit -m "替换 Chroma 双主题配色：Catppuccin Latte/Mocha

紫色 keyword token（.k/.kr/.kp/.nt）换皮肤蓝，深色经 .dark-theme 覆写。"
```

---

### Task 4: 代码块外框 / 行号 / 复制按钮

**Files:**
- Modify: `assets/js/main.js`（加 `_Blog.copyCode()` + ready 调用）
- Modify: `assets/css/_common/_page/post.scss`（加 `.chroma-wrapper`/`pre.chroma`/`.ln`/`.copy-code-btn` 样式块）

**Interfaces:**
- Consumes: Task 1 的 `.chroma-wrapper`/`.copy-code-btn`/`.ln`/`.cl` 结构、Task 3 的 token 配色
- Produces: 代码块圆角外框、行号样式、hover 显现复制按钮 + 点击复制排除行号纯代码。

- [ ] **Step 1: main.js 新增 copyCode 逻辑**

在 `assets/js/main.js` 的 `_Blog.toggleMobileMenu` 函数定义后（`_Blog.toggleMobileMenu = function() {...}` 闭合 `}` 之后、`$(document).ready` 之前）插入：

```js
    // 代码块复制按钮：复制排除行号的纯代码，反馈 1.5 秒
    _Blog.copyCode = function() {
        $('.copy-code-btn').on('click', function() {
            // clone 后移除行号 .ln，取纯代码文本，避免复制带行号
            var code = $(this).siblings('.highlight').find('code').clone();
            code.find('.ln').remove();
            var text = code.text();
            var btn = this;
            navigator.clipboard.writeText(text).then(function() {
                var original = btn.textContent;
                btn.textContent = '已复制 ✓';
                setTimeout(function() { btn.textContent = original; }, 1500);
            });
        });
    };
```

在 `$(document).ready(function() {` 块内（`_Blog.toggleMobileMenu()` 之后）加一行：

```js
        _Blog.copyCode()
```

ready 块最终应为：
```js
    $(document).ready(function() {
        _Blog.changeTitle()
        _Blog.toggleTheme()
        _Blog.toggleMobileMenu()
        _Blog.copyCode()
    });
```

- [ ] **Step 2: 验证 main.js 语法**

Run:
```bash
node --check assets/js/main.js && echo "SYNTAX OK"
```
Expected: `SYNTAX OK`。

- [ ] **Step 3: post.scss 新增代码块容器样式**

在 `assets/css/_common/_page/post.scss` 的 `.post-content { ... }` 块内、现有 `code, pre { ... }`（第 86-94 行）规则之后插入代码块容器样式：

```scss
        // Chroma 代码块外框（render-codeblock.html 产出 .chroma-wrapper）
        .chroma-wrapper {
            position: relative;
            margin: 1.2em 0;
            padding: 0;
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            background: #f6f8fa;
            overflow: hidden;

            .dark-theme & {
                background: #2b2d31;
                border-color: #3a3d41;
            }

            // hover 时才显现复制按钮
            &:hover .copy-code-btn {
                opacity: 1;
            }

            .copy-code-btn {
                position: absolute;
                top: 6px;
                right: 6px;
                z-index: 2;
                padding: 2px 10px;
                font-size: 12px;
                color: #4c4f69;
                background: rgba(255, 255, 255, 0.7);
                border: 1px solid #e1e4e8;
                border-radius: 4px;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.2s ease-out;

                .dark-theme & {
                    color: #cdd6f4;
                    background: rgba(43, 45, 49, 0.8);
                    border-color: #3a3d41;
                }
            }

            // 内层 pre：去掉自带背景与外边距，由 wrapper 统一控制
            .highlight {
                margin: 0;
            }
            pre.chroma {
                margin: 0;
                padding: 14px 16px;
                background: transparent;
                border: 0;
                border-radius: 0;
                overflow-x: auto;
                font-size: 13px;
                line-height: 1.6;
            }
            // 行号：浅色、不可选（复制不带行号）
            .ln {
                color: #a0a0a0;
                user-select: none;
                .dark-theme & {
                    color: #6e7681;
                }
            }
        }
```

- [ ] **Step 4: 构建验证**

Run:
```bash
cd exampleSite && /usr/local/bin/hugo --themesDir ../.. --quiet 2>&1 | grep -iE "error|scss" | head
```
Expected: 无报错。

检查产出 CSS 含新选择器：
```bash
grep -o 'chroma-wrapper\|copy-code-btn\|pre\.chroma' exampleSite/public/css/*.css 2>/dev/null | sort | uniq -c
```
Expected: 三者均出现（被 minify 后选择器仍在）。

- [ ] **Step 5: Commit**

```bash
git add assets/js/main.js assets/css/_common/_page/post.scss
git commit -m "代码块外框/行号/复制按钮样式与逻辑

.chroma-wrapper 圆角外框、行号浅灰不可选、hover 显现复制按钮，复制排除行号纯代码。"
```

---

### Task 5: 行内代码柔色胶囊

**Files:**
- Modify: `assets/css/_common/_page/post.scss:96-108`

**Interfaces:**
- Consumes: 皮肤蓝（浅 `#2d96bd` / 深 `#63b8fd`）
- Produces: 行内 `code:not([class])` 柔色胶囊样式。

- [ ] **Step 1: 替换行内代码样式**

`assets/css/_common/_page/post.scss` 第 96-108 行现有：
```scss
        code:not([class]) {
            padding: 5px 5px;
            background: #fff;
            border: 1px solid #ddd;
            box-shadow: 1px 1px 0 #fff, 2px 2px 0 #ddd;
            margin-left: 3px;
            margin-right: 3px;

            .dark-theme &:not([class]) {
                background: transparent;
                box-shadow: 1px 1px 0 $dark-font-secondary-color, 2px 2px 0 $dark-font-secondary-color;
            }
        }
```
替换为：
```scss
        // 行内代码：柔色胶囊，与代码块 keyword 蓝同源
        code:not([class]) {
            padding: 2px 6px;
            margin: 0 2px;
            font-size: 0.9em;
            color: #2d96bd;
            background: rgba(45, 150, 189, 0.10);
            border-radius: 4px;
            word-break: break-word;

            .dark-theme & {
                color: #63b8fd;
                background: rgba(99, 184, 253, 0.14);
            }
        }
```

- [ ] **Step 2: 构建验证**

Run:
```bash
cd exampleSite && /usr/local/bin/hugo --themesDir ../.. --quiet 2>&1 | grep -iE "error|scss" | head
```
Expected: 无报错。

- [ ] **Step 3: Commit**

```bash
git add assets/css/_common/_page/post.scss
git commit -m "行内代码改为柔色胶囊样式

去掉便利贴立体投影，改主题蓝柔色背景圆角胶囊，明暗双模式适配。"
```

---

### Task 6: 引用块主题色竖条

**Files:**
- Modify: `assets/css/_common/_core/base.scss:89-105`

**Interfaces:**
- Consumes: 皮肤蓝（浅 `#2d96bd` / 深 `#63b8fd`）
- Produces: blockquote 主题色竖条 + 柔色底。

- [ ] **Step 1: 替换 blockquote 样式**

`assets/css/_common/_core/base.scss` 第 89-105 行现有：
```scss
blockquote {
  font: 14px/22px normal helvetica, sans-serif;
  margin-top: 10px;
  margin-bottom: 10px;
  margin-left: 2%;
  margin-right: 0%;
  padding-left: 15px;
  padding-top: 10px;
  padding-right: 10px;
  padding-bottom: 10px;
  border-left: 3px solid #ccc;
  background-color:#f1f1f1;

  .dark-theme & {
    background-color:$dark-blockquote-background-color;
  }
}
```
替换为：
```scss
// 引用块：主题色竖条 + 柔色底（与皮肤蓝统一）
blockquote {
  margin: 10px 0;
  padding: 10px 16px;
  border-left: 4px solid #2d96bd;
  border-radius: 0 6px 6px 0;
  background-color: rgba(45, 150, 189, 0.06);
  color: $light-font-secondary-color;

  .dark-theme & {
    border-left-color: #63b8fd;
    background-color: rgba(99, 184, 253, 0.10);
    color: $dark-font-secondary-color;
  }
}
```

- [ ] **Step 2: 构建验证**

Run:
```bash
cd exampleSite && /usr/local/bin/hugo --themesDir ../.. --quiet 2>&1 | grep -iE "error|scss" | head
```
Expected: 无报错（`$light-font-secondary-color` / `$dark-font-secondary-color` 已在 `_variables/default.scss` 定义，可用）。

- [ ] **Step 3: Commit**

```bash
git add assets/css/_common/_core/base.scss
git commit -m "引用块改为主题色竖条样式

去掉灰底灰边，改皮肤蓝左竖条 + 柔色底圆角，明暗双模式适配。"
```

---

### Task 7: 终验（生产构建 + 主仓库零改动）

**Files:**
- 无文件改动，纯验证。

**Interfaces:**
- Consumes: Task 1-6 全部产出
- Produces: 验证全部 7 条标准通过，确认可交付。

- [ ] **Step 1: 生产构建无报错**

Run:
```bash
cd exampleSite && HUGO_ENV=production /usr/local/bin/hugo --gc --minify --themesDir ../.. 2>&1 | tail -5
```
Expected: 无 error，显示构建统计（Pages 数等）。

- [ ] **Step 2: 产出 JS bundle 不含 prettify**

Run:
```bash
grep -rl "prettyPrint" exampleSite/public/js/ 2>/dev/null
```
Expected: 无输出。

- [ ] **Step 3: 产出 HTML 含 chroma 结构、无 prettyprint**

Run:
```bash
echo "=== chroma 结构 ===" && grep -rl 'chroma-wrapper' exampleSite/public/ 2>/dev/null | head -1 && echo "=== prettyprint（应为空）===" && grep -rl 'prettyprint' exampleSite/public/ 2>/dev/null | head
```
Expected: chroma-wrapper 有命中文件；prettyprint 无输出。

- [ ] **Step 4: 主仓库 config.toml 零改动**

Run:
```bash
git -C /Users/bruce/Developer/blog diff config.toml
```
Expected: 无输出（主仓库配置未被改动）。

- [ ] **Step 5: 人工浏览器验证清单**

需用户手动执行主题预览并核对（dev server 由用户启动）：
```bash
cd exampleSite && hugo server -D --themesDir ../..
```
浏览器打开后逐项核对：
1. 浅色模式：代码块 Latte 配色，`def`/`return` 等关键字显示青蓝 `#2d96bd`
2. 点右上角主题切换 → 深色模式：代码块 Mocha 配色，关键字显示亮蓝 `#63b8fd`
3. 行内代码：浅色青蓝胶囊 / 深色亮蓝胶囊
4. 引用块：浅色青蓝竖条 / 深色亮蓝竖条
5. 鼠标移到代码块：右上角浮现「复制」按钮
6. 点复制按钮：剪贴板得到**不含行号**的纯代码，按钮变「已复制 ✓」1.5 秒后恢复「复制」

- [ ] **Step 6: 汇报验证结果**

向用户汇报 Step 1-4 命令输出，并请用户确认 Step 5 浏览器核对结果。全部通过即改造完成。

> 注：submodule 推送与主仓库指针更新属部署流程，按主仓库 CLAUDE.md「双 git 子模块」由用户决定时机，不在本计划自动执行。
