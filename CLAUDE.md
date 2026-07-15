# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库定位

这是 Hugo 博客主题 **LeaveIt** 的 fork（`github.com/mrbruce516/LeaveIt`，原作 `liuzc/LeaveIt`），作为主仓库 `blog` 的 git submodule 挂在 `themes/LeaveIt`。

- 本仓库**只含主题**，不含站点内容/配置；站点的 `config.toml`、`content/`、`static/` 都在主仓库。
- `exampleSite/` 是主题自带的演示站点（独立 `config.toml` + 演示内容），用于离线预览主题，**不要**当作真实站点配置来源。
- 主题的站点级外观/模板改动在本 submodule 内提交并推送其远端，再回主仓库更新 submodule 指针（见主仓库 CLAUDE.md 的「双 git 子模块」说明）。

## 构建与预览

无构建脚本、无测试、无 lint。主题的「构建」即 Hugo 的资源管线（assets → public），需 **Hugo extended**（SCSS 编译依赖）。

预览主题本身（用 exampleSite）：
```bash
cd exampleSite && hugo server -D --themesDir ../..
```
真实站点预览回到主仓库执行 `hugo server`。

生产构建需带环境变量（见下「生产环境门控」）：
```bash
HUGO_ENV=production hugo --gc --minify
```

## 资源管线（最关键，改动前必读）

主题用 Hugo Pipes 在模板里处理 SCSS/JS，逻辑分散在 partials 中，不看容易踩坑。

### CSS：`layouts/partials/css.html`
```
resources.Get "css/main.scss" | resources.ToCSS | resources.Minify
```
- 入口 `assets/css/main.scss` 通过 `@import` 串联：`_variables/default.scss`（主题色变量）→ `_common/_core|_page|_section|_prettyprint/*.scss` → 末尾 `@import "custom"`。
- **自定义样式钩子是 `assets/css/_custom.scss`**（README 推荐的覆写入口），改变量则编辑 `_variables/default.scss`。
- 字体图标走 `assets/font/iconfont.css`，单独 `<link>` 引入。

### JS：`layouts/partials/js.html`（条件化打包，非全量）
脚本被 `resources.Concat | resources.Minify` 成不同包，按页面类型分流：
- **文章页且含图片**（`Scratch.postHasImages`）→ `vendor_gallery.js`：含 jquery/lazysizes/prettify/dynamic/main/lightGallery/lightGallery-init/_custom（图库功能齐全）。
- **文章页无图片** → `vendor_no_gallery.js`：去掉 lazysizes 与 lightGallery 系。
- **非文章页（首页/列表/归档等）** → `vendor_main.js`：仅 jquery + main。

含义：新增依赖某个第三方库时，要确认它在哪个 bundle、是否所有需要的页面都打包进去了；只放进 `assets/js/` 不会自动加载。
- **自定义脚本钩子是 `assets/js/_custom.js`**，已含「顶部阅读进度条」等定制逻辑。

### 生产环境门控（`getenv "HUGO_ENV" == "production"`）
仅生产环境启用：Google Analytics、百度统计（`params.baiduAnalytics`）、CDN 前缀（`params.cdn_url`）。本地 `hugo server` 默认不进这些分支，排查统计/CDN 问题时要带上 `HUGO_ENV=production`。

## 已有的 fork 定制点（不在原主题里，改动时注意别误删）

- `layouts/shortcodes/bilibili.html`：`{{< bilibili AV或BV号 [分P] >}}`，自动识别 AV/BV。
- `layouts/shortcodes/spoiler.html`：`{{< spoiler >}}隐藏文字{{< /spoiler >}}`，渲染为 `.spoiler` span。
- `assets/css/_custom.scss`：阅读进度条 `.top-scroll-bar`、侧边目录 `.post-toc`（>1224px 才显示）等定制样式。
- `layouts/partials/head.html`：硬编码引入 APlayer + MetingJS（jsdelivr CDN），以及一条百度站点验证 meta。音乐播放器走原生 `<meting-js>` 标签（详见主仓库 `content/readme.md`），非 shortcode。
- `assets/js/main.js` 的 `_Blog.changeTitle`：窗口失焦时把 `document.title` 改成 `'MAJI'`，聚焦恢复。

## 前端行为要点

- **暗/亮主题**：`.theme-switch` 点击切换 `body.dark-theme`，状态存 `localStorage.theme`；变量定义在 `_variables/default.scss`（`$light-*` / `$dark-*`）。
- **代码高亮**用 Google code-prettify（`pre` 加 `prettyprint linenums`），**不是** Hugo 内置 Chroma。
- **图片懒加载** lazysizes（用 `data-src`）；**图库** lightGallery（`lightGallery-init.js` 扫描 `.post-content figure`，带 `class="gallery-ignore"` 的 figure 跳过）。
- 首页模式由 `params.home_mode` 决定：`"post"` → `home_post.html`（文章列表），否则 `home_profile.html`（个人卡片）。

## 布局结构速览

- `layouts/_default/baseof.html` 是骨架：`head` → `header` → `content` block → `footer`。各页面通过 `{{ define "content" }}` 填充。
- `index.html` 按 `home_mode` 选择 home partial；`_default/single.html`（单文，含 toc/meta/字数/阅读时长）、`posts.html`（按年分组的归档）、`list.html`（分类/标签列表）、`terms.html`。
- `layouts/partials/`：`head`/`header`/`footer`/`css`/`js`/`toc`/`social`/`paginator`/`related`/`seo_schema`/`music`/`wechat` 等。`headerBak.html` 是旧版备份，不用。
- `header.html` 顶部阅读进度条仅在文章页且未设 `notsb` front matter 时出现。
