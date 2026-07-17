# Implementation Plan — AI 增强叠加层

## 1. 模型与正文落盘

- [ ] 扩展 `NewsItem`：可选 `bodyText`，并补充运行时校验。
- [ ] 三源 scraper 将 parser 的 `bodyText` 写入快照。
- [ ] 更新 parser/snapshot 测试，覆盖正文保留及旧快照兼容。

## 2. 历史正文 backfill

- [ ] 新增 `scripts/backfill-body-text.ts`，复用三源 parser 与 HTTP 工具。
- [ ] 支持 `--source <id|all>`、默认跳过已有正文、`--force`。
- [ ] 单条失败隔离，输出进度和最终成功/失败汇总；安全写回各源快照。
- [ ] 注册 `npm run backfill:body-text` 并测试参数解析/合并纯函数。

## 3. Enrichment 数据契约

- [ ] 新增 enrichment 类型、状态常量、文件级/记录级校验。
- [ ] 实现稳定 fingerprint：规范化 `title + "\n" + bodyText` 后 SHA-256。
- [ ] 初始化 `data/enrichments/<sourceId>.json` 空文件。
- [ ] 测试 reviewed/pending/skip、日期覆盖、无效 schema 与 fingerprint。

## 4. Pending CLI

- [ ] 实现 `enrich:list-pending`，支持 `--limit`、`--source` 和机器可读 JSON 输出。
- [ ] 实现 P0 stale → P1 已有日期 → P2 疑似活动漏抽 → P3 其余的稳定排序。
- [ ] 将活动线索抽为共享纯函数，避免与规则抽取器重复维护。
- [ ] 注册 npm script，并覆盖筛选、排序、限制和缺正文情形。

## 5. Build overlay 与中文输出

- [ ] 在 feeds 层读取/校验 enrichment，并仅应用 `status=reviewed` 且 fingerprint 当前有效的记录。
- [ ] 中文字段使用 `titleZh ?? title`、`summaryZh ?? summary`；人工 `eventDates`（包括空数组）显式覆盖规则结果。
- [ ] feed 展开支持中文 `[举办]` / `[发售]` 前缀。
- [ ] `public/data/news.json` 保留日文字段并附带中文字段，但排除 `bodyText`。
- [ ] 增加 overlay、补录、stale 回退、RSS 与 iCal 中文输出测试。

## 6. 前端显示

- [ ] 更新共享前端类型，日历统一读取 `titleZh ?? title`。
- [ ] 调整 `src/web` 纯函数及测试；重新运行 `npm run build:web` 生成静态 bundle。

## 7. Cursor 项目 Skill

- [ ] 按 Cursor Skill 规范创建 `.cursor/skills/enrich-news/SKILL.md`。
- [ ] Skill 自动触发场景：用户要求人工增强、汉化、核对或补录抓取资讯。
- [ ] 固定批次流程：列 pending → 逐条读正文与规则日期 → 写 reviewed/skip → validate → build/test → 预览。
- [ ] 明确禁止：调用外部付费 AI API、修改日文原文、在证据不足时猜测日期。

## 8. 数据回填与验证

- [ ] 先在小源/有限样本运行 backfill，检查正文质量与文件体积。
- [ ] 全量回填三源现有快照；失败条目形成可重试清单。
- [ ] 运行 `npm run enrich:validate`、`npm run build`、`npm run ci`。
- [ ] 本地预览日历，并抽查 RSS XML 与 iCal DTSTART/SUMMARY/DESCRIPTION。

## Review / Rollback Points

- 首次全量回填前记录 `data/*/latest.json` diff；若解析质量异常，只回滚生成数据，不回滚模型代码。
- enrichment 应用失败必须让 build 非零退出，不得静默发布损坏 feed。
- 若公开 `news.json` 体积异常，确认 `bodyText` 已在序列化前剔除。
- 不修改 GitHub Actions 的 cron、AI 调用或部署架构。

## Validation Commands

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build:web
npm run build:feeds
npm run ci
```
