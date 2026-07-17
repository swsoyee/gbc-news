# Design: 修正技术债审查问题

## Scope

首批修正建议覆盖审查 Top 5：前端拆分与测试、scrape 单源隔离、文档/spec 对齐、feed-entry/build-feeds 测试、scrape/HTML 公共库抽取。

## Architecture Boundaries

### Frontend

- 保持 `public/` 静态部署模型。
- 优先把 `subscribe.js` 内部逻辑拆成可测试的纯函数，或在 `src/web/` / `src/frontend/` 建立可被测试和复制到 `public/` 的轻量模块。
- 不引入框架；如需要构建，只使用现有 TypeScript/tsx/esbuild 工具链或简单脚本。

### Scrape / Scripts

- 新增 `scripts/lib/` 或 `src/scrapers/shared/` 中的通用工具：
  - snapshot read/write/merge
  - scrape mode resolve
  - source result summary
- 编排脚本可新增一个 Node/TS orchestration entry，让三源独立执行、记录失败、最终汇总。

### HTML Utilities

- 新增 `src/utils/html.ts`，集中 `stripTags`、`decodeHtml`、文本归一化。
- 逐步替换 scraper 内重复实现，保留 fixtures 测试作为回归保护。

### Feed Function / Build

- 尽量减少 `feed-entry.ts` 对公网自 fetch 的依赖；若首批不改加载策略，至少把 handler 逻辑拆成可测试函数。
- `build-feeds` 测试聚焦：输入为空或部分源缺失时不得生成空订阅覆盖有效输出。

### Docs / Specs

- README 描述当前三源能力、定时状态、本地预览、动态订阅/静态订阅差异。
- `docs/architecture.md` 明确前端当前已包含日历交互，但仍保持零框架静态模式。
- `.trellis/spec/frontend/*` 更新目录与质量边界，避免未来 AI 误判「无需 UI」。

## Compatibility

- 公开 URL 保持：`/feeds/*.xml`、`/feeds/*.ics`、`/api/feed`。
- `public/data/news.json` shape 保持。
- 本地命令尽量保持 README 中现有入口。

## Risks

- 前端拆分若引入构建，可能影响 Netlify 静态发布；默认避免。
- Scrape 编排改变退出码语义，需确保 CI 仍能在「全部失败」时失败。
- 抽取 HTML 工具可能造成解析输出细微变化，必须依赖 fixtures 回归。

## Rollback

- 每个子范围单独提交。
- 若前端拆分风险过高，可先只抽纯函数测试，不搬文件。
- 若编排改造导致 CI 不稳定，可回退到原三命令但保留通用工具抽取。
