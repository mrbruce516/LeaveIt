# 文章页 TOC 现代化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将文章页侧边 TOC 从右侧改为左侧栏，新增滚动高亮当前章节与自动折叠，视觉简约现代。

**Architecture:** 模板 `toc.html` 删除手写 jQuery 吸附脚本改用 CSS `sticky`；样式 `_custom.scss` 重写 `.post-toc` 定位（左移 + sticky）与 `.active`/`.has-active` 视觉；逻辑 `_custom.js` 用 `IntersectionObserver` 做 scroll-spy 高亮并维护祖先链 `.has-active` 实现自动折叠。三者通过 Hugo `.TableOfContents` 渲染的 `<nav id="TableOfContents">` 结构与 `#anchor` id 关联，不改模板数据结构。

**Tech Stack:** Hugo extended（SCSS → Hugo Pipes）、原生 CSS `position: sticky`、`IntersectionObserver`、jQuery（主题既有，沿用风格保持一致）。

**Spec:** `docs/superpowers/specs/2026-07-15-toc-modernization-design.md`

## Global Constraints

- 本仓库是主题 submodule（`github.com/mrbruce516/LeaveIt`），所有改动在此内提交并推送其远端；不在主仓库改主题文件。
- 主题色用 `#63b8fd`（与现有进度条、toc hover 一致），二级文字色用变量 `$light-font-secondary-color` / `$dark-font-secondary-color`。
- 不自动安装依赖、不自动启动服务；预览/构建命令需用户手动执行。
- 注释用中文，解释「为什么」。
- commit message 用中文。
- 预览主题用 exampleSite：`cd exampleSite && hugo server -D --themesDir ../..`；真实站点预览回主仓库 `hugo server`。
- 生产构建：`HUGO_ENV=production hugo --gc --minify`。

## 文件结构

| 文件 | 责任 |
|------|------|
| `layouts/partials/toc.html` | TOC 容器结构 + `always-active` front matter 判断；删除旧 jQuery 吸附脚本 |
| `assets/css/_custom.scss` | `.post-toc` 左侧定位 + sticky + 滚动容器；`.active` 竖条高亮、`.has-active` 折展、去 scale；暗色适配 |
| `assets/js/_custom.js` | 顶部进度条（既有，保留）+ TOC scroll-spy 与自动折叠（新增） |

三者分工：`toc.html` 只管结构、`_custom.scss` 只管外观与定位、`_custom.js` 只管交互状态。状态通过 class（`.active` / `.has-active`）在 CSS 与 JS 间传递，无其它耦合。

---

## Task 1: 模板移除旧 jQuery 吸附脚本，保留结构

**Files:**
- Modify: `layouts/partials/toc.html`（全文替换）

**Interfaces:**
- Produces: `.post-toc` 容器（`#post-toc`）内含 `.post-toc-title` 与 `.post-toc-content`（含 `always-active` class），其内为 Hugo 渲染的 `<nav id="TableOfContents">…</nav>`。后续 Task 2/3 依赖这些 class 与 `#TableOfContents` 锚点。删除脚本后吸附由 CSS sticky 接管。

- [ ] **Step 1: 替换 `toc.html` 为纯结构版本**

将 `layouts/partials/toc.html` 全文替换为：

```html
<div class="post-toc" id="post-toc">
  <h2 class="post-toc-title">{{ T "toc" }}</h2>
  {{ $globalAutoCollapseToc := .Site.Params.autoCollapseToc | default false }}
  <div class="post-toc-content{{ if not (or .Params.autoCollapseToc (and $globalAutoCollapseToc (ne .Params.autoCollapseToc false))) }} always-active{{ end }}">
    {{.TableOfContents}}
  </div>
</div>
```

说明：删除了原文件第 8–34 行的 `<script>`（手写 `fixTop/miss` 吸附计算），吸附改由 Task 2 的 CSS `sticky` 实现；容器结构、`always-active` 判断逻辑保持不变。

- [ ] **Step 2: 本地预览确认页面不报错**

提示用户执行（主题预览）：
```bash
cd exampleSite && hugo server -D --themesDir ../..
```
Expected: 打开任意文章页，控制台无 JS 报错；TOC 此刻仍按旧样式显示在右侧、无吸附（吸附已删，待 Task 2 重建），页面不崩。

- [ ] **Step 3: Commit**

```bash
git add layouts/partials/toc.html
git commit -m "移除 TOC 旧版 jQuery 滚动吸附脚本

改由 CSS sticky 接管，删除易错的 fixTop/miss 计算。"
```

---

## Task 2: 重写 `.post-toc` 样式（左侧栏 + sticky + 高亮 + 折展）

**Files:**
- Modify: `assets/css/_custom.scss`（替换第 17–75 行 `//toc目录` 整块）

**Interfaces:**
- Consumes: Task 1 产出的 `.post-toc` / `.post-toc-title` / `.post-toc-content` / `always-active`；Task 3 将在 `<a>` 上加 `.active`、在祖先 `<li>` 上加 `.has-active`。
- Produces: `.post-toc a.active`（左侧竖条 + 加粗主题色）、`.post-toc .has-active > ul { display: block }`（折展规则）、`.post-toc` 左侧 sticky 定位与滚动容器；窄屏 `@media (max-width:1224px) { display:none }`。

- [ ] **Step 1: 替换 `_custom.scss` 中的 TOC 样式块**

把 `assets/css/_custom.scss` 中从 `//toc目录` 到第 75 行 `}` 结束（含其后空行前的整个 `.post-toc {…}` 及其 `@media`）替换为：

```scss
//toc目录：左侧栏，滚动高亮 + 自动折叠
.post-toc {
    position: absolute;
    width: 200px;
    // 贴正文(780px居中)左边缘外侧，留 24px 间距
    right: 100%;
    margin-right: 24px;
    top: 2rem;
    // sticky 吸附：随滚动固定，替代旧版手写 fixed
    position: -webkit-sticky;
    position: sticky;
    // 目录过高时自带滚动，避免顶到评论区
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
    padding: 0 10px;
    box-sizing: border-box;
    word-wrap: break-word;

    .post-toc-title {
        margin: 0 0 10px;
        font-size: 0.875em;
        font-weight: 600;
        color: $light-font-secondary-color;
        .dark-theme & {
            color: $dark-font-secondary-color;
        }
    }

    .post-toc-content {
        &.always-active ul {
            display: block;
        }
        > nav > ul {
            margin: 0;
        }
        ul {
            padding-left: 0;
            list-style: none;
            ul {
                padding-left: 14px;
                display: none; // 默认折叠子级
            }
            // 当前章节祖先链展开
            .has-active > ul {
                display: block;
            }
        }
    }

    a {
        position: relative;
        display: block;
        padding-left: 12px;
        line-height: 28px;
        font-size: 0.875em;
        color: $light-font-secondary-color;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        transition: color .2s ease-out;
        .dark-theme & {
            color: $dark-font-secondary-color;
        }

        // 当前章节：左侧竖条 + 加粗主题色
        &.active {
            font-weight: 600;
            color: #63b8fd;
            &::before {
                content: "";
                position: absolute;
                left: 0;
                top: 6px;
                bottom: 6px;
                width: 3px;
                border-radius: 2px;
                background: #63b8fd;
            }
        }

        &:hover {
            color: #63b8fd;
        }
    }
}
@media only screen and (max-width: 1224px) {
    .post-toc {
        display: none;
    }
}
```

说明（为什么这么写）：
- `right: 100%; margin-right: 24px` 把 TOC 从正文右侧（旧 `margin-left:780px`）翻到左侧外缘并留间距，无需依赖正文宽度硬编码。
- `sticky` + `max-height/overflow` 替代旧版 fixed 计算，天然不顶评论区（容器最高到视口减导航栏高度）。
- 删除旧版 `text-transform: uppercase`（标题大写）与 `a:hover { transform: scale(1.1) }`（弹跳），改为颜色过渡，更现代。
- 子级默认 `display:none`，仅 `.has-active > ul` 展开；`always-active` 模式（文章 front matter 指定不折叠时）整体展开。
- 高亮竖条用 `::before` 绝对定位，`top/bottom` 留余量使竖条比行高略短，视觉精致。

- [ ] **Step 2: 本地预览确认定位与外观**

提示用户执行：
```bash
cd exampleSite && hugo server -D --themesDir ../..
```
Expected（宽屏 ≥1224px）：TOC 出现在正文**左侧**外缘，随页滚动 sticky 吸附；标题不大写、hover 无弹跳、颜色过渡；窄屏（拖窄至 <1224px）TOC 消失。此刻尚无滚动高亮（待 Task 3），目录子级默认折叠（无 `.has-active`）。

- [ ] **Step 3: 生产构建确认 SCSS 编译通过**

提示用户执行：
```bash
HUGO_ENV=production hugo --gc --minify
```
Expected: 构建成功，无 SCSS 编译报错。

- [ ] **Step 4: Commit**

```bash
git add assets/css/_custom.scss
git commit -m "重写 TOC 样式：左侧栏 + sticky 吸附 + 竖条高亮与折叠

从右侧改为左侧并排，删除大写与 hover 弹跳，改用颜色过渡；
新增 .active 左侧竖条与 .has-active 折展规则，暗色适配。"
```

---

## Task 3: 新增 scroll-spy 高亮与自动折叠逻辑

**Files:**
- Modify: `assets/js/_custom.js`（在文件末尾追加）

**Interfaces:**
- Consumes: Task 1 的 `#TableOfContents` 结构（`a[href^="#"]` 指向正文标题 id）；Task 2 的 `.active` / `.has-active` class 契约。
- Produces: 滚动正文时，当前进入视口上 1/3 的标题对应目录项 `<a>` 加 `.active`，其所有祖先 `<li>` 加 `.has-active`，其余项移除。空 TOC / 无 IntersectionObserver 时安全降级。

- [ ] **Step 1: 在 `_custom.js` 末尾追加 TOC 高亮逻辑**

在 `assets/js/_custom.js` 现有内容（顶部进度条逻辑）之后追加：

```javascript
// TOC 滚动高亮 + 自动折叠：监听正文标题，高亮当前章节并展开其祖先链
$(document).ready(function () {
    var $tocLinks = $('#TableOfContents a[href^="#"]');
    if ($tocLinks.length === 0) return; // 文章无标题则跳过

    // 不支持 IntersectionObserver 时降级：目录可用但不自动高亮折叠
    if (!('IntersectionObserver' in window)) return;

    // 收集标题元素，建立 标题 -> 对应目录链接 的映射
    var headings = [];
    $tocLinks.each(function () {
        var id = decodeURIComponent(this.getAttribute('href').slice(1));
        var el = document.getElementById(id);
        if (el) headings.push({ el: el, link: this });
    });
    if (headings.length === 0) return;

    // 记录最近一次高亮项，避免重复 DOM 操作
    var currentLink = null;

    function setActive(link) {
        if (link === currentLink) return;
        currentLink = link;

        // 清理旧状态
        $('#TableOfContents a.active').removeClass('active');
        $('#TableOfContents li.has-active').removeClass('has-active');

        // 当前项高亮，并给所有祖先 <li> 加 has-active 以展开折叠链
        $(link).addClass('active');
        $(link).parents('li').addClass('has-active');
    }

    // 触发线压在视口约 1/3 处：标题越过该线即回调
    var observer = new IntersectionObserver(function () {
        var topLine = window.innerHeight / 3;
        var best = null;
        // 在全部标题中找「最后一个已越过触发线的」作为当前项，
        // 保证多标题同屏时选中最贴近视口顶部那个
        for (var i = 0; i < headings.length; i++) {
            var rect = headings[i].el.getBoundingClientRect();
            if (rect.top <= topLine) {
                best = headings[i].link;
            }
        }
        if (!best) best = headings[0].link; // 滚到最顶部时高亮第一项
        if (best) setActive(best);
    }, {
        rootMargin: '-33% 0px -60% 0px', // 标题进入视口上 1/3 区域时回调
        threshold: 0
    });

    headings.forEach(function (h) { observer.observe(h.el); });
});
```

说明（为什么这么写）：
- 用 `IntersectionObserver` 而非 scroll 事件，性能更好且无需手动节流。
- `rootMargin: '-33% 0px -60% 0px'` 把「触发线」压到视口约 1/3 处，标题越过该线即回调；回调内再遍历所有标题取「最后一个已越过触发线的」作为当前项，保证多标题同屏时选中最贴近视口顶部的那个。
- `setActive` 用 `currentLink` 去重，避免每次滚动都改 DOM；祖先链用 jQuery `parents('li')` 一次性加 `.has-active`，与 Task 2 的 `.has-active > ul { display:block }` 配合展开。
- 两处提前 `return` 处理空 TOC 与无 `IntersectionObserver` 的降级，目录仍可点击跳转、不报错。

- [ ] **Step 2: 本地预览确认高亮与折展**

提示用户执行：
```bash
cd exampleSite && hugo server -D --themesDir ../..
```
Expected（宽屏文章页，文章含多级标题）：
- 滚动正文，当前章节对应目录项出现**左侧竖条 + 加粗主题色**，其余项柔和灰。
- 子级目录仅当前章节所在父级链展开（如滚到「2.1」时「二 → 2.1」展开），滚到「三」时「二」收起、「三」展开。
- 滚回顶部时第一项高亮。
- 点击目录项仍能正常跳转到对应标题（锚点行为未被破坏）。

- [ ] **Step 3: 生产构建确认打包无误**

提示用户执行：
```bash
HUGO_ENV=production hugo --gc --minify
```
Expected: 构建成功，`_custom.js` 被并入文章页 bundle，无报错。

- [ ] **Step 4: Commit**

```bash
git add assets/js/_custom.js
git commit -m "新增 TOC 滚动高亮与自动折叠交互

用 IntersectionObserver 监听正文标题，高亮当前章节(左侧竖条)
并展开其祖先链；空 TOC 与无 IO 支持时安全降级。"
```

---

## Task 4: 真实站点验证与推送

**Files:**
- 无文件改动（验证 + submodule 指针更新流程说明）

**Interfaces:**
- Consumes: Task 1–3 的全部产出。

- [ ] **Step 1: 真实站点预览验证**

提示用户回主仓库执行：
```bash
cd /Users/bruce/Developer/blog && hugo server -D
```
Expected: 任选一篇含多级标题的文章，确认：左侧栏定位、滚动高亮竖条、自动折叠、暗色主题（点右上角主题切换）、窄屏隐藏全部符合 spec 验证标准 1–6。

- [ ] **Step 2: 生产构建终检**

提示用户在主仓库执行：
```bash
cd /Users/bruce/Developer/blog && HUGO_ENV=production hugo --gc --minify
```
Expected: 构建通过（spec 验证标准 7）。

- [ ] **Step 3: 推送主题 submodule 远端**

提示用户在主题目录执行（**涉及外部网络，需用户确认后手动执行**）：
```bash
cd /Users/bruce/Developer/blog/themes/LeaveIt && git push origin master
```
Expected: 三个 commit（Task 1/2/3）推送到 `github.com/mrbruce516/LeaveIt`。

- [ ] **Step 4: 回主仓库更新 submodule 指针（由用户决定是否现在做）**

说明：本步属主仓库操作，超出主题 submodule 范围。提示用户：若要部署，回主仓库 `git add themes/LeaveIt && git commit -m "更新 LeaveIt submodule：TOC 现代化"` 并推送，触发 Pages。**此步需用户自行确认执行，不在本计划自动完成。**
