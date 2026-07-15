# 文章页 TOC 目录现代化设计

日期：2026-07-15
所属仓库：主题 fork `themes/LeaveIt`（submodule）

## 问题与目标

文章页侧边目录（TOC）当前体验偏老旧，需要优化为更现代化、简约、优雅的展示，并明确要求「靠左」。

### 现状分析

实现散落在两处：

- 模板：`layouts/partials/toc.html`，含容器结构与一段 jQuery 滚动吸附脚本。
- 样式：`assets/css/_custom.scss` 第 18–75 行 `.post-toc`。

现状关键事实：

1. **位置在右侧**：`.post-toc { position: absolute; margin-left: 780px }`，贴着 780px 居中正文的右侧。需改为靠左。
2. **吸附靠手写 jQuery**：`toc.html` 的 `window.onload` 里用 `fixTop/miss/endTop` 计算并在 `fixed`/`absolute` 间切换，逻辑易错且与评论区 `.post-comment` 耦合。
3. **没有滚动高亮**：CSS 里写了 `.has-active > ul { display: block }`，但**没有任何 JS 给标题或目录项加 active 类**，所以「当前章节高亮」功能实际未生效，子级目录基本处于常驻展开状态。
4. **不现代的视觉点**：标题大写（`text-transform: uppercase`）、hover 时 `transform: scale(1.1)` 弹跳。
5. **窄屏隐藏**：`@media (max-width: 1224px) { .post-toc { display: none } }`，沿用此策略。
6. **文章页 JS 打包**：`layouts/partials/js.html` 把 `assets/js/_custom.js` 打进文章页两个 bundle（`vendor_gallery.js` / `vendor_no_gallery.js`），新逻辑放 `_custom.js` 即可在所有文章页自动加载；主题整体用 jQuery，新 JS 沿用 jQuery 风格保持一致。

### 目标

- TOC 移到正文**左侧**并排成左侧栏。
- 加「滚动高亮当前章节」：当前项左侧竖条 + 文字加粗。
- 加「自动折叠」：只展开当前 active 项所在父级链的子级，其余收起。
- 视觉简约优雅：去掉大写与 hover 弹跳，柔和灰色 + 主题色对比。
- 暗色主题适配。
- 窄屏（<1224px）保持隐藏，不堆移动端交互。

## 设计决策（已与用户确认）

| 维度 | 选择 |
|------|------|
| 放置方式 | 左侧栏，窄屏（<1224px）隐藏 |
| 滚动高亮 | 加 scroll-spy 高亮当前章节，子级自动折叠 |
| 当前项高亮样式 | 左侧竖条（伪元素）+ 文字加粗主题色 |

## 设计方案

### 1. 布局与定位

TOC 从正文右侧移到左侧，与 780px 居中正文并排成左侧栏。

```
宽屏 ≥1224px
┌─────────┬──────────────────────┐
│  目录    │      文章标题         │
│ ─ 一     │  ──────────────────  │
│ ─ 二  ┃  │  正文……              │
│    └ 2.1 │  ## 二                │
│ ─ 三     │                      │
└─────────┴──────────────────────┘
   200px          780px(居中)
```

要点：

- 沿用 `position: absolute` 框架，把 `margin-left: 780px`（右侧）改为**左侧负向偏移**：TOC 宽 200px，贴正文左边缘外侧，留约 24px 间距（实现上用 `right: 100%; margin-right: 24px` 或等价负 margin）。
- 吸附改用 CSS `position: sticky` 替代手写 `fixed` 切换，更稳更现代；容器设 `max-height` + `overflow-y: auto`，目录过高时自带滚动且不顶评论区，删掉 `toc.html` 里易错的 `fixTop/miss` 计算。
- 窄屏（<1224px）保持 `display: none`。
- 暗色主题：目录文字、竖条、hover 色走 `_variables/default.scss` 的 `$dark-*` 变量。

### 2. 滚动高亮（scroll-spy）

数据基础：Hugo 的 `.TableOfContents` 渲染为 `<nav id="TableOfContents"><ul><li><a href="#anchor">…`，每个 `<a>` 的 `href` 即正文 `<h2>/<h3>` 的 `id`。靠这套 id 做目录↔正文双向关联，不改模板结构。

交互：

- 用 `IntersectionObserver` 监听正文所有标题（`#TableOfContents a` 的 href 指向的元素），标题进入视口上 1/3 区域时，给对应目录项 `<a>` 加 `.active`。
- 当前项：左侧竖条（`::before` 伪元素，约 3px 宽、主题色、圆角）+ 文字加粗变深。
- 其余项：柔和灰色（`$light-font-secondary-color`，暗色取 `$dark-*` 对应），hover 变主题色。
- 去掉现有 hover 的 `transform: scale(1.1)`，改为颜色 `transition` 过渡。

### 3. 自动折叠

默认只展开当前 active 项所在父级链的子级 `<ul>`，其余 `<li>` 的子级 `display: none`。

- 复用现有 CSS 方向 `.has-active > ul { display: block }`。
- 新 JS 在高亮时给当前项的所有祖先 `<li>` 加 `.has-active`，移除其他项的。
- 滚到「2.1」时目录展开「二 → 2.1」，滚到「三」时「二」收起、「三」展开。

### 4. 不变项

- `.top-scroll-bar` 顶部阅读进度条（`_custom.js` 第 5–8 行）保留不动，与 TOC 高亮互不干扰。
- `toc.html` 容器结构与 `always-active` 的 front matter 判断逻辑保留。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `layouts/partials/toc.html` | 删 jQuery 滚动吸附脚本（改用 CSS sticky），保留容器与 `always-active` 判断 |
| `assets/js/_custom.js` | 新增 scroll-spy + 自动折叠逻辑（约 30–40 行，jQuery 风格，挂 `$(document).ready`） |
| `assets/css/_custom.scss` | 重写 `.post-toc` 定位（左移 + sticky）+ `.active`/`.has-active` 样式 + 去 `scale`；暗色适配 |

## 边界处理

- 文章无标题（空 TOC）：容器为空，CSS 自然不占位，无需特判。
- 目录过高超出视口：sticky 容器 `max-height` + `overflow-y: auto` 自带滚动，不顶评论区。
- `prefers-reduced-motion`：仅颜色过渡、无位移动画，天然友好。

## 验证标准

1. 宽屏（≥1224px）下 TOC 出现在正文**左侧**并排，随页滚动 sticky 吸附、不顶评论区。
2. 滚动正文时，目录当前章节项出现**左侧竖条 + 加粗主题色**，其余项柔和灰。
3. 子级目录仅当前章节所在父级链展开，其余收起；滚动切换时折叠随之变化。
4. hover 目录项为颜色过渡，无 `scale` 弹跳；标题不大写。
5. 暗色主题下颜色与对比正常。
6. 窄屏（<1224px）TOC 隐藏，正文不受影响。
7. `HUGO_ENV=production hugo --gc --minify` 构建通过；本地 `hugo server -D` 预览正常。

## 风险

- `position: sticky` 需父级无 `overflow: hidden` 截断，实现时要确认 `.post-warp`/祖先链不阻断 sticky 上下文；若受阻则回退为改进后的 fixed 方案。
- `IntersectionObserver` 在极旧浏览器不支持，但主题目标环境为现代浏览器，可接受（必要时降级为不高亮、不折叠，目录仍可用）。
