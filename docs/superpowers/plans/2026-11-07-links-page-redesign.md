# 友链页面重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将友链页（`/links`）重构为极简 IT 博客风的「分组标题 + 统一卡片网格」，移除横幅头像条、互动画布、朋友圈加载等冗余元素。

**Architecture:** 新建独立 `links.css` 承载友链页样式（不污染全局 `zhheoblog.css`）；重写 `content-links.html` 宏只做分组+卡片渲染；两个入口模板（`links.html`/`page_links.html`）切换到新 CSS。

**Tech Stack:** Thymeleaf 模板、CSS Grid、Halo 链接系统（`linkFinder.groupBy()`）

---

## 文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 新建 | `templates/assets/css/links.css` | 友链页专属样式 |
| 重写 | `templates/macro/content-links.html` | 分组 + 卡片网格渲染 |
| 修改 | `templates/links.html` | 引入 links.css，移除 fcircle CSS |
| 修改 | `templates/page_links.html` | 同上 |
| 修改 | `settings.yaml` | 移除 `fcircleUrl`、`linksCanvas` |
| 修改 | `theme.yaml` | 版本号 1.7.110 → 1.7.111 |

**保留不动：**
- `templates/macro/links-canvas.html` — 不再被引用，保留文件避免其他依赖
- `templates/assets/html/link-canvas.html` — 同上
- `annotation-setting.yaml` — `displayStyle`/`label`/`labelColor`/`siteshot` 注解保留（后台可填但页面不渲染）
- `settings.yaml` 中 `fmomentsPageSize`/`fmomentsApiUrl` — 被 `friends.html`（朋友圈页）使用，保留

---

## Task 1: 新建 links.css

**Files:**
- Create: `templates/assets/css/links.css`

- [ ] **Step 1: 创建 links.css，写入完整样式**

```css
/* 友链页面样式 - 极简 IT 博客风 */

.links-page {
    --links-card-radius: 10px;
    --links-card-gap: 16px;
    --links-favicon-size: 32px;
}

/* 标题区 */
.links-hero {
    margin-bottom: 32px;
}

.links-hero .banners-title-small {
    font-size: 0.85rem;
    color: var(--heo-fontcolor);
    opacity: 0.6;
    letter-spacing: 0.05em;
}

.links-hero .banners-title-big {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--heo-fontcolor);
    margin-top: 4px;
}

/* 分组 */
.links-group {
    margin-bottom: 40px;
}

.links-group-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--heo-fontcolor);
    margin: 0 0 4px;
    display: flex;
    align-items: baseline;
    gap: 8px;
}

.links-group-count {
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--heo-fontcolor);
    opacity: 0.5;
}

.links-group-desc {
    font-size: 0.8rem;
    color: var(--heo-fontcolor);
    opacity: 0.6;
    margin: 0 0 16px;
    line-height: 1.5;
}

/* 卡片网格 */
.links-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--links-card-gap);
}

/* 友链卡片 */
.links-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: var(--heo-card-bg);
    border: 1px solid var(--style-border);
    border-radius: var(--links-card-radius);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    text-decoration: none;
    transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.links-card:hover {
    transform: translateY(-3px);
    border-color: var(--heo-theme);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    text-decoration: none;
}

.links-card-favicon {
    width: var(--links-favicon-size);
    height: var(--links-favicon-size);
    min-width: var(--links-favicon-size);
    border-radius: 8px;
    background: var(--heo-secondbg);
    object-fit: contain;
    padding: 3px;
    box-sizing: border-box;
}

.links-card-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.links-card-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--heo-fontcolor);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
    -webkit-line-clamp: 1;
    transition: color 0.25s ease;
}

.links-card:hover .links-card-name {
    color: var(--heo-theme);
}

.links-card-desc {
    font-size: 0.8rem;
    color: var(--heo-fontcolor);
    opacity: 0.6;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
    -webkit-line-clamp: 2;
    word-break: break-word;
}

/* 响应式 */
@media screen and (max-width: 600px) {
    .links-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
```

- [ ] **Step 2: 验证文件创建成功**

Run: `wc -l templates/assets/css/links.css`
Expected: 约 130 行

- [ ] **Step 3: 提交**

```bash
git add templates/assets/css/links.css
git commit -m "feat(links): add standalone links.css for redesigned links page"
```

---

## Task 2: 重写 content-links.html 宏

**Files:**
- Modify: `templates/macro/content-links.html`（全文替换）

- [ ] **Step 1: 读取当前文件确认结构**

当前 `content-links.html` 包含横幅区、头像滚动条、`links-canvas`、三种 `displayStyle`、朋友圈 JS。全部移除。

- [ ] **Step 2: 用以下内容全文替换 content-links.html**

```html
<th:block th:fragment="content-links(htmlType)">

    <th:block th:with="groups = ${linkFinder.groupBy()}">
        <div class="links-page" id="banners">
            <!-- 标题区 -->
            <div class="links-hero">
                <div class="banners-title-small" th:text="${theme.config.link.smallTitle}"></div>
                <div class="banners-title-big" th:text="${theme.config.link.bigTitle}"></div>
            </div>

            <!-- 分组 + 卡片网格 -->
            <th:block th:each="group : ${groups}">
                <div class="links-group">
                    <h2 class="links-group-title" th:if="${not #strings.isEmpty(group.spec.displayName)}">
                        <span th:text="${group.spec.displayName}"></span>
                        <span class="links-group-count" th:text="'(' + ${group.links.size} + ')'"></span>
                    </h2>
                    <p class="links-group-desc"
                       th:if="${not #strings.isEmpty(#annotations.get(group, 'description'))}"
                       th:text="${#annotations.get(group, 'description')}"></p>

                    <div class="links-grid">
                        <a class="links-card" th:each="link : ${group.links}"
                           th:href="${link.spec.url}"
                           th:title="${link.spec.description}"
                           target="_blank" rel="external nofollow">
                            <img class="links-card-favicon"
                                 th:alt="${link.spec.displayName}"
                                 th:with="img = @{${link.spec.logo}}"
                                 th:src="${isLazyload ? '' : img}"
                                 th:data-lazy-src="${isLazyload ? img : ''}">
                            <div class="links-card-body">
                                <span class="links-card-name" th:text="${link.spec.displayName}"></span>
                                <span class="links-card-desc" th:text="${link.spec.description}"></span>
                            </div>
                        </a>
                    </div>
                </div>
            </th:block>

            <!-- 底部自定义内容 -->
            <th:block th:if="${not #strings.isEmpty(theme.config.link.linksArticle)}"
                      th:utext="${theme.config.link.linksArticle}"></th:block>

            <!-- 单页内容（page_links.html 场景） -->
            <th:block th:if="${htmlType == 'page'}" th:utext="${singlePage.content.content}"></th:block>
        </div>
    </th:block>
</th:block>
```

- [ ] **Step 3: 验证模板语法**

Run: `grep -c "links-card" templates/macro/content-links.html`
Expected: ≥ 4（卡片相关类名出现）

Run: `grep -c "fcircle\|links-canvas\|tags-group\|displayStyle" templates/macro/content-links.html`
Expected: 0（旧元素已清除）

- [ ] **Step 4: 提交**

```bash
git add templates/macro/content-links.html
git commit -m "refactor(links): rewrite content-links macro to group + card grid"
```

---

## Task 3: 更新 links.html 入口

**Files:**
- Modify: `templates/links.html:15`（替换 CSS 引用）

- [ ] **Step 1: 移除 fcircle CSS，引入 links.css**

将第 15 行：
```html
<link rel="stylesheet" type="text/css" th:href="${assets_link + '/libs/fcircle/heo-fcircle3.css'}">
```
替换为：
```html
<link rel="stylesheet" type="text/css" th:href="${assets_link + '/css/links.css' + theme_version}" data-pjax>
```

- [ ] **Step 2: 验证**

Run: `grep -n "links.css\|fcircle" templates/links.html`
Expected: 只有 `links.css` 一行，无 `fcircle`

- [ ] **Step 3: 提交**

```bash
git add templates/links.html
git commit -m "feat(links): switch links.html to links.css, remove fcircle css"
```

---

## Task 4: 更新 page_links.html 入口

**Files:**
- Modify: `templates/page_links.html:16`（替换 CSS 引用）

- [ ] **Step 1: 移除 fcircle CSS，引入 links.css**

将第 16 行：
```html
<link rel="stylesheet" type="text/css" th:href="${assets_link + '/libs/fcircle/heo-fcircle3.css'}">
```
替换为：
```html
<link rel="stylesheet" type="text/css" th:href="${assets_link + '/css/links.css' + theme_version}" data-pjax>
```

- [ ] **Step 2: 验证**

Run: `grep -n "links.css\|fcircle" templates/page_links.html`
Expected: 只有 `links.css` 一行，无 `fcircle`

- [ ] **Step 3: 提交**

```bash
git add templates/page_links.html
git commit -m "feat(links): switch page_links.html to links.css, remove fcircle css"
```

---

## Task 5: 清理 settings.yaml 中无用配置

**Files:**
- Modify: `settings.yaml:1934-1964`（`link` 分组）

- [ ] **Step 1: 移除 `fcircleUrl` 配置项（第 1934-1937 行）**

删除：
```yaml
        - $formkit: url
          name: fcircleUrl
          value: "/fcircle"
          label: 鱼塘链接
```

- [ ] **Step 2: 移除 `linksCanvas` 配置项（第 1942-1945 行）**

删除：
```yaml
        - $formkit: switch
          name: linksCanvas
          label: 互动友链
          value: false
```

- [ ] **Step 3: 验证保留项**

Run: `grep -n "fmomentsPageSize\|fmomentsApiUrl\|fcircleUrl\|linksCanvas" settings.yaml`
Expected: `fmomentsPageSize` 和 `fmomentsApiUrl` 仍存在；`fcircleUrl` 和 `linksCanvas` 不存在

- [ ] **Step 4: 提交**

```bash
git add settings.yaml
git commit -m "chore(links): remove unused fcircleUrl and linksCanvas settings"
```

---

## Task 6: 版本号 +1

**Files:**
- Modify: `theme.yaml:62`

- [ ] **Step 1: 版本号 1.7.110 → 1.7.111**

```yaml
  version: "1.7.111"
```

- [ ] **Step 2: 验证**

Run: `grep "version" theme.yaml`
Expected: `version: "1.7.111"`

- [ ] **Step 3: 提交**

```bash
git add theme.yaml
git commit -m "chore: bump version to 1.7.111"
```

---

## 整体验证（所有任务完成后）

- [ ] **Step 1: 检查无残留旧引用**

```bash
grep -rn "heo-fcircle3" templates/
grep -rn "links-canvas" templates/macro/content-links.html templates/links.html templates/page_links.html
```
Expected: 无输出

- [ ] **Step 2: 检查新文件都已就位**

```bash
ls -la templates/assets/css/links.css templates/macro/content-links.html
```
Expected: 两个文件都存在

- [ ] **Step 3: 本地启动 Halo 访问 /links，人工验收**

验收点：
1. 页面按分组展示统一卡片网格
2. 每张卡片：favicon + 名称 + 描述，描述两行截断
3. hover 上浮 + 边框变主题色
4. 无 iframe、无朋友圈请求、无控制台报错
5. 窄屏（<600px）显示 2 列

---

## 自审清单

- [x] **Spec 覆盖**：分组标题✓、卡片网格✓、三段式卡片✓、白卡细边框✓、favicon 统一底板✓、描述两行截断✓、hover 上浮✓、移除冗余元素✓、保留评论/底部内容✓
- [x] **无占位符**：所有代码块完整，无 TBD/TODO
- [x] **类型一致**：CSS 类名 `links-card`/`links-card-favicon`/`links-card-name`/`links-card-desc` 在 Task 1 和 Task 2 中一致
- [x] **范围聚焦**：只改友链页相关文件，不动 friends.html 朋友圈页
