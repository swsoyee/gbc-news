# 前端目录结构

## 当前布局

```text
public/
  index.html            # 订阅说明 + 筛选 + 活动日历
  subscribe.js          # DOM / 交互（ESM，依赖 subscribe-core）
  subscribe-core.js     # 由 src/web 打包的纯函数（生成物）
  feeds/                # 静态 RSS / iCal（build-feeds 生成）
  data/news.json        # 合并快照（日历与统计读取）
src/web/
  subscribe-core.ts     # URL 构建、日历格子/跨日 segment 等可测逻辑
scripts/
  bundle-web.mjs        # esbuild → public/subscribe-core.js
```

## 约定

1. **Feed 文件路径稳定**：对外 URL 一经发布尽量不改；改名需写迁移说明。
2. **页面职责**：发现订阅链接、组合×分类筛选、活动日历；不做后台管理。
3. **优先零框架**：禁止为订阅页引入 React/Vue。允许用现有 esbuild 把 `src/web` 打成单个 ESM。
4. **逻辑与 DOM 分离**：日期/筛选/URL 等纯函数放 `src/web/` 并写 Vitest；`subscribe.js` 只做挂载与事件。

## 禁止

- 在首屏堆砌仪表盘卡片、统计条、无关营销模块
- 为静态说明页引入大型 UI 框架
- 把抓取逻辑放到浏览器端执行
- 手改 `public/feeds/` / `public/data/news.json` / `public/subscribe-core.js`（应用脚本再生）
