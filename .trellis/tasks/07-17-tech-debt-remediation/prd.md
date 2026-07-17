# 修正技术债审查问题

## Goal

降低当前仓库中最影响后续迭代稳定性的技术债，重点处理前端日历单体膨胀、抓取编排失败隔离、文档与实现漂移、动态订阅测试缺口，以及抓取/HTML 公共逻辑重复。

## Background / Confirmed Facts

- 技术债审查已完成，主要问题集中在：前端单体化、scrape 编排无单源隔离、README / architecture / Trellis frontend spec 漂移、Netlify Function 与 build-feeds 覆盖不足、scrape 脚本和 HTML 工具重复。
- 当前主路径已有质量基线：TypeScript strict、ESLint、Prettier、Vitest、CI、parser fixtures。
- 近期日历功能让 `public/index.html` 与 `public/subscribe.js` 继续膨胀，前端可维护性风险上升。
- `package.json` 的 `scrape` 仍以 `&&` 串联三源；单源失败会阻断后续源。
- `netlify/functions/feed-entry.ts` 通过公网 fetch `public/data/news.json`，且缺少 handler 单测。
- README / docs / `.trellis/spec/frontend/*` 与当前「三源 + 完整日历 UI」状态存在漂移。

## Requirements

### R1. 前端结构与可测性

- 将前端订阅页中可独立维护的日历/链接逻辑拆出或重组，降低 `public/subscribe.js` 单体复杂度。
- 保持零构建或极低构建复杂度，不引入大型 UI 框架。
- 至少补充前端关键逻辑测试，覆盖筛选 URL、日历视图切换、跨日事件显示或复制交互中的高风险路径。

### R2. Scrape 编排单源隔离

- 改造 scrape 编排，使单个来源失败不会阻止其他来源完成抓取与 feed 构建。
- 失败路径必须有明确日志和最终退出码；不得写入空订阅或空快照覆盖有效数据。

### R3. 文档与规范对齐

- README、`docs/architecture.md`、`.trellis/spec/frontend/*` 应反映当前能力：GBC / FIRST RIFF / collabo-cafe 三源、分类/组合订阅、月/周/日历 UI、GitHub Actions 定时状态。
- 文档应保留低成本、静态优先、不引入重型前端框架的边界。

### R4. 动态订阅与 feed 构建测试

- 为 `netlify/functions/feed-entry.ts` 增加测试，覆盖静态数据加载/筛选/错误路径。
- 为 `build-feeds` 或相关 feed 构建路径补充至少一个失败/缺源保护用例。

### R5. 重复逻辑抽取

- 抽取 scrape 脚本中的通用快照合并/读取/写入/模式解析逻辑。
- 抽取 HTML strip/decode 工具，避免多个 scraper 实体解码行为漂移。

## Acceptance Criteria

- [x] `npm run lint` 通过。
- [x] `npm run format:check` 通过。
- [x] `npm run typecheck` 通过。
- [x] `npm test` 通过，且测试数量或覆盖面反映新增测试。
- [x] Scrape 编排支持单源失败隔离，并有测试或可验证脚本证明不会覆盖空订阅。
- [x] README / docs / Trellis frontend spec 不再描述过时状态。
- [x] 前端拆分后仍可通过 `npx serve public` 本地预览，订阅链接路径保持兼容。

## Out Of Scope For First Pass

- 不迁移到 React/Vue/Vite 等前端框架。
- 不改变公开 feed URL。
- 不移除 `data/` 或 `public/feeds/` 的 git 跟踪策略；仓库膨胀治理作为后续任务。
- 不一次性重写所有 HTML 正则解析器为 DOM parser。
- 不引入付费基础设施或常驻服务。

## Delivery Decisions

- 首批范围：R1–R5 全部完成。
- 执行方式：多个小提交；每完成一个可独立验证的小改动就 commit。
- 不引入前端框架；公开 feed URL 保持兼容。
