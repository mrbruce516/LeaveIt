# 博文代码块 / 行内代码 / 引用块现代化改造设计

日期：2026-07-17
范围：仅 `themes/LeaveIt` submodule（主仓库 `config.toml` 零改动）

## 一、问题分析

当前博文页面中三处「框」样式陈旧，不符合现代审美：

1. **行内代码** `code:not([class])`（`assets/css/_common/_page/post.scss:96-108`）：白底 + 1px 灰边 + 双层偏移投影（`1px 1px 0 #fff, 2px 2px 0 #ddd`），老式便利贴立体效果。
2. **代码块** `pre`：用 Google Code Prettify（已于 2015 年归档停维），客户端 JS 染色，固定深色 `#2d2d2d`，明暗主题都是深色，无圆角无边框；语言识别靠通用正则，现代语法（TS 泛型、Rust 生命周期等）常染色错；首屏代码无颜色直到 JS 执行。
3. **引用块** `blockquote`（`assets/css/_common/_core/base.scss:89-105`）：浅灰底 `#f1f1f1` + 左侧 3px 灰边，朴素。

用户需求：三处全部改造，明暗双模式适配，代码块跟随主题变色（不固定深色），用最现代化的高亮方案，配色用 Catppuccin（紫色 token 替换为皮肤蓝），加复制按钮，尽量不侵入主仓库。

## 二、技术方案选型

### 高亮引擎：Chroma（弃用 Prettify）

- **Prettify**：Google 已归档，客户端 JS 染色，语法覆盖差。彻底移除。
- **Chroma**：Hugo 官方内置、持续维护、构建时服务端染色（首屏即带色、无 JS 依赖、SEO 友好）、语法覆盖全。是当代 Hugo 博客事实标准。
- **Shiki**（VS Code 同款）：最现代但 Hugo 无原生支持，需 Hugo Module + 额外构建链，侵入架构。**不采用**。

结论：Chroma。Prettify 与 Chroma 不可并存（都染 `pre/code`），必须彻底替换。

### 双主题衔接：CSS 双套 + `.dark-theme` 覆写

- 浅色默认生效，深色用 `.dark-theme` 前缀全量覆写 token 颜色。
- 复用现有 `body.dark-theme` 切换机制，**不改主题切换 JS**。
- 前提：Chroma 输出须用语义 class（`noClasses=false`）而非 inline style，否则深色覆写无法生效。

### 配置归属：主题 render hook（主仓库零改动）

已用 Hugo v0.133.0+extended 实测验证：

- 代码块 render hook 文件名为 **`layouts/_default/_markup/render-codeblock.html`**（非 `render-code.html`）。
- hook 上下文字段：代码内容为 **`.Inner`**（非 `.Code`），语言为 `.Type`。
- 在 hook 内调用 `highlight .Inner .Type "lineNos=true, noClasses=false, lineNumbersInTable=false"`，选项通过函数第三参数传入，**不依赖主仓库 `[markup.highlight]` 配置**。
- 主仓库 `config.toml` 即使完全无 `[markup.highlight]` 段，Hugo 0.133 默认即用 Chroma 染色。
- 输出结构：`<div class="highlight"><pre class="chroma"><code class="language-xxx"><span class="line"><span class="ln">N</span><span class="cl"><span class="k">...</span></span></span>...</code></pre></div>`。

实测脚本（已清理）：
```go
// layouts/_default/_markup/render-codeblock.html
{{- $lang := .Type | default "text" -}}
{{- $result := highlight .Inner $lang "lineNos=true, noClasses=false, lineNumbersInTable=false" -}}
<div class="chroma-wrapper" data-lang="{{ $lang }}">
  <button class="copy-code-btn" type="button" aria-label="复制代码">复制</button>
  {{- $result -}}
</div>
```
渲染结果确认：`.chroma-wrapper` 包裹、复制按钮注入、token 为 class（`class="k"` 而非 inline style）、行号在 `.ln` span。

## 三、配色方案

### 代码块 token：Catppuccin Latte（浅）/ Mocha（深）

来源：`catppuccin/chroma` 官方仓库 `dist/latte-chroma-style.css` 与 `dist/mocha-chroma-style.css`，均为 `.chroma .xx` 后代选择器，与本方案输出结构一致。

- Latte 基底：背景 `#eff1f5`、前景 `#4c4f69`
- Mocha 基底：背景 `#1e1e2e`、前景 `#cdd6f4`
- 两份的 `background-color` 去除，改由 `.chroma-wrapper` 统一控制背景，避免双层背景冲突。

**紫色 token 替换为皮肤蓝**（Catppuccin 紫仅用于 4 个 keyword 类 token）：

| 选择器 | 含义 | Latte 原色 → 新色 | Mocha 原色 → 新色 |
|---|---|---|---|
| `.chroma .k` | 关键字 | `#8839ef` → `#2d96bd` | `#cba6f7` → `#63b8fd` |
| `.chroma .kr` | 保留字 | `#8839ef` → `#2d96bd` | `#cba6f7` → `#63b8fd` |
| `.chroma .kp` | 关键字占位 | `#8839ef` → `#2d96bd` | `#cba6f7` → `#63b8fd` |
| `.chroma .nt` | 标签名 | `#8839ef` → `#2d96bd` | `#cba6f7` → `#63b8fd` |

其余 Catppuccin token（字符串绿、函数蓝、注释灰、数字橙、错误红等）原样保留。

皮肤蓝来源：
- `#2d96bd` = `$light-post-link-color`（浅色链接色，`_variables/default.scss:16`）
- `#63b8fd` = TOC 激活色 / 进度条色（`_custom.scss:85,94,99`，深色模式已在用）

### 行内代码点缀色（与代码块 keyword 蓝同源）

- 浅色：背景 `rgba(45,150,189,0.10)`、文字 `#2d96bd`
- 深色：背景 `rgba(99,184,253,0.14)`、文字 `#63b8fd`

### 引用块点缀色（同上）

- 浅色：左 4px 边 `#2d96bd`、背景 `rgba(45,150,189,0.06)`
- 深色：左 4px 边 `#63b8fd`、背景 `rgba(99,184,253,0.10)`

## 四、视觉规格

### 代码块外框 `.chroma-wrapper`

- 圆角 8px，1px 细边框，`position: relative`（承载复制按钮）
- 浅色：背景 `#f6f8fa`、边框 `#e1e4e8`
- 深色：背景 `#2b2d31`、边框 `#3a3d41`

### 内层 `pre.chroma`

- 去外边距、去自带背景（由 wrapper 统一）
- `overflow-x: auto`
- 等宽字体沿用 `'Fira Code', Consolas, Monaco, Menlo, monospace`

### 行号 `.ln`

- 浅色 `#a0a0a0`、深色 `#6e7681`
- 右侧留 1em 间距
- `user-select: none`（复制时不带走行号）

### 复制按钮 `.copy-code-btn`

- 默认隐藏（`opacity:0`），hover `.chroma-wrapper` 时显现（`opacity:1`）
- 绝对定位右上角，半透明小药丸
- 点击复制 `pre` 内**不含行号**的纯代码（取 `.cl` 行文本，排除 `.ln`）
- 成功后文案变「已复制 ✓」，1.5 秒后恢复「复制」

### 行内代码 `code:not([class])`

- 去掉白底 + 灰边 + 双层投影
- 柔色胶囊：圆角 4px、`padding: 2px 6px`、字号 `0.9em`
- 配色见上节

### 引用块 `blockquote`

- 去掉浅灰底 + 3px 灰边
- 左侧主题色 4px 竖条 + 柔色底 + 圆角（`0 6px 6px 0`）
- 字体继承正文字体（不再强制 helvetica）
- 保留留白

## 五、改动清单（全部在 `themes/LeaveIt` 内）

1. **新增** `layouts/_default/_markup/render-codeblock.html`：主题接管代码块渲染，生成 Chroma 语义 class 输出 + `.chroma-wrapper` + 复制按钮。选项经 `highlight` 函数第三参数传入，不依赖主仓库配置。
2. **替换** `assets/css/_common/_prettyprint/default.scss`：改为 Chroma 双主题样式（Latte 默认 + `.dark-theme` Mocha 覆写），紫色 4 token 换皮肤蓝。**保留 `default.scss` 文件名、仅替换文件内容**（不重命名、不改 `main.scss` 的 `@import`），减少联动改动，符合「优先局部替换」纪律。目录名 `_prettyprint` 暂不改（仅内部样式，不影响功能）。
3. **改** `assets/js/main.js`：删除 `_Blog.prettify()` 及其 `$(document).ready` 调用；新增 `_Blog.copyCode()`（绑定 `.copy-code-btn` 点击，复制排除行号的纯代码，反馈「已复制 ✓」1.5 秒）。
4. **改** `assets/css/_common/_page/post.scss:96-108`：行内 `code:not([class])` 改柔色胶囊。
5. **改** `assets/css/_common/_core/base.scss:89-105`：blockquote 改主题色竖条 + 柔色底。
6. **改** `layouts/partials/js.html`：从 `vendor_gallery`、`vendor_no_gallery` bundle 的 slice 移除 `$prettify`；删除 `$prettify := resources.Get "/js/prettify.min.js"` 行。
7. **删除** `assets/js/prettify.min.js`（已确认可删；Prettify 彻底移除，文件不再被引用）。

**主仓库 `config.toml`：不动。**

## 六、风险

1. **样式文件不重命名**：`_prettyprint/default.scss` 仅替换内容、不改文件名，避免联动改 `main.scss` 的 `@import` 路径（符合「优先局部替换」纪律）。目录名 `_prettyprint` 暂不改，仅内部样式不影响功能。
2. **复制内容含行号**：Chroma 行号在 `.ln` span。jQuery `.text()` 会带上行号。实现时须只取 `.cl`（实际代码行）文本，或 `clone` 后移除 `.ln` 再 `.text()`。
3. **clipboard API 协议**：`navigator.clipboard` 需安全上下文。生产 `blog.mrbruce516.online`（HTTPS）可用；`hugo server`（localhost）属安全上下文亦可用。无需降级。
4. **submodule 提交流程**：主题改动需在 `themes/LeaveIt` 内提交并推送其远端，再回主仓库更新 submodule 指针（见主仓库 CLAUDE.md「双 git 子模块」）。
5. **Goldmark 行内代码不经 hook**：render hook 仅作用于围栏代码块；行内 `` `code` `` 仍输出裸 `<code>`，由 `code:not([class])` 样式覆盖，已验证此选择器不受 Chroma 影响。

## 七、验证标准（动手前明确，声称完成前必须跑）

1. `cd exampleSite && hugo server -D --themesDir ../..` 下，文章代码块渲染为 Chroma 语义 class（`.chroma .k` 等），**无** `prettyprint` class。
2. 浅色模式：代码块 Latte 配色，keyword 显示青蓝 `#2d96bd`。
3. 切深色模式：代码块 Mocha 配色，keyword 显示亮蓝 `#63b8fd`。
4. 行内代码柔色胶囊、引用块主题色竖条，明暗各正确。
5. hover 代码块出现复制按钮；点击复制出**不含行号**的纯代码；按钮变「已复制 ✓」1.5 秒后恢复。
6. `HUGO_ENV=production hugo --gc --minify` 构建无报错；产出 JS bundle 不含 prettify。
7. 主仓库 `config.toml` 无改动（`git -C 主仓库 diff config.toml` 为空）。
