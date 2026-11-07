# 友链页面重构设计

**日期**: 2026-11-07
**主题**: halo-theme-hao
**版本**: 1.7.110 → (重构后)

## 背景

当前友链页（`/links`）由 `templates/macro/content-links.html` 渲染，存在以下问题：

1. **结构过载**：一个宏里塞了横幅区、滚动头像条、互动友链画布（iframe）、三种 `displayStyle` 分组样式、朋友圈文章加载 JS，职责混乱。
2. **样式不统一**：`beautify`/`default`/`deprecated` 三种样式视觉割裂，且 CSS 散落在 `zhheoblog.css` 中，与全站样式耦合。
3. **卡片问题**（上一轮已部分修复）：高度不一、favicon 模糊、描述截断粗糙。
4. **冗余功能**：互动画布（`links-canvas.html`）依赖 iframe，体验差；朋友圈文章加载对大多数用户无用。

## 目标

重构为**极简 IT 博客风**的友链页，核心是「分组标题 + 统一卡片网格」，干净、易读、专业。

## 设计决策

### 整体风格
- 极简 IT 博客风：干净留白、细边框、柔和阴影、无衬线字体
- 配色沿用主题现有 CSS 变量，不引入新颜色
- 与站点近期的终端/赛博朋克风（repositories、portal）区分，友链页走克制路线

### 布局结构
统一卡片网格，不再区分 `displayStyle`：
```
页头（复用 nav）
标题区（smallTitle + bigTitle）
分组列表 × N
  ├─ 分组标题（displayName + 数量）
  ├─ 分组描述（可选 annotation description）
  └─ 卡片网格（auto-fill minmax(240px, 1fr)）
      └─ 友链卡片 × N
```

### 卡片（三段式 + 白卡细边框）
```
┌─────────────────────────────┐
│  [favicon]  站点名称          │  favicon 32px 统一底板，名称 15px/600
│             一句话描述...      │  描述 13px/次级灰，line-clamp 2
└─────────────────────────────┘
```
- 容器：白底 + `1px solid var(--style-border)` + 极淡阴影，`border-radius: 10px`，`padding: 14px 16px`
- hover：`translateY(-3px)` + 边框变 `var(--heo-theme)` + 阴影加深，过渡 0.25s
- favicon：32×32，`object-fit: contain`，统一浅灰圆角底板（`background: var(--heo-secondbg)`，`border-radius: 8px`，`padding: 3px`），解决透明底/锯齿
- 名称：`font-size: 0.95rem; font-weight: 600; line-clamp: 1`
- 描述：`font-size: 0.8rem; opacity: 0.6; line-clamp: 2; word-break: break-word`，`title` 属性悬浮显示全文
- 整卡由 `<a>` 包裹，点击跳转外链

### 分组
- 分组标题：`h2`，`font-size: 1.25rem; font-weight: 700`，数量用灰色小字 `(12)`
- 分组描述：`0.8rem`，次级灰，`margin-top: 4px`
- 分组间距：`margin-bottom: 40px`
- 卡片网格：`display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px`

### 移除的元素
- 横幅区滚动头像条（`.tags-group-all`）
- 互动友链画布（`links-canvas` iframe + `links-canvas.html`）
- 朋友圈文章加载（`fdataUser` + `heo-fcircle3mini.js`）
- 三种 `displayStyle`（`beautify`/`default`/`deprecated`），统一卡片
- `siteshot` 截图顶图、`label`/`labelColor` 角标

### 保留的配置（settings.yaml `link` 分组）
- `smallTitle` / `bigTitle`
- `linksUrl`
- `enable_comment`
- `linksArticle`（底部自定义 HTML）

### 移除的配置
- `linksCanvas`
- `fmomentsPageSize`
- `fmomentsApiUrl`
- `fcircleUrl`（鱼塘链接，朋友圈相关）

### 响应式断点
- ≥1200px: 约 5 列（`minmax(240px, 1fr)` 自适应）
- 768–1200px: 约 4 列
- 600–768px: 约 3 列
- <600px: 2 列

## 实现范围

### 新建
- `templates/assets/css/links.css` — 友链页专属样式，独立于 `zhheoblog.css`

### 重写
- `templates/macro/content-links.html` — 只保留分组 + 卡片网格渲染
- `templates/links.html` — 引入 `links.css`，移除 `heo-fcircle3.css`
- `templates/page_links.html` — 同上

### 修改
- `settings.yaml` — 移除 `linksCanvas`/`fmomentsPageSize`/`fmomentsApiUrl`/`fcircleUrl`
- `theme.yaml` — 版本号 +1

### 不动
- `templates/macro/links-canvas.html` — 保留文件但不再引用（避免其他地方依赖）
- `annotation-setting.yaml` — 保留 `displayStyle`/`label`/`labelColor`/`siteshot` 注解定义（后台仍可填，但页面不渲染），不破坏后台表单

## 非目标
- 不改动 Halo 链接系统的数据结构
- 不引入新的 JS 交互（随机访问按钮可保留，纯前端）
- 不做暗色主题适配（沿用现有变量，亮暗主题自动适配）
- 不做友链申请表单（`link-submit` 插件已有）

## 验收标准
1. 友链页加载后，按分组展示统一风格的卡片网格
2. 每张卡片显示 favicon、站点名称、描述，描述两行截断，悬浮显示全文
3. 卡片 hover 有上浮 + 边框变色效果
4. 无控制台报错，无 iframe 加载，无朋友圈 JS 请求
5. 响应式：窄屏自动降列
6. 评论区正常显示（如启用）
