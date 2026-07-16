# gbc-news

定时从官网抓取资讯，并向用户提供 **RSS** 与 **iCal** 订阅接口。

## 目标

- 低成本：优先使用免费额度（GitHub Actions 定时任务 + Netlify 静态托管）
- 可订阅：稳定输出 RSS / iCal
- 可维护：用 Trellis 管理规格与任务，用 GitHub Issues + Project 管理进度

## 技术选型（低成本）

| 能力          | 方案                                     | 成本考量                              |
| ------------- | ---------------------------------------- | ------------------------------------- |
| 代码托管 / CI | GitHub + GitHub Actions                  | 公开仓库 Actions 免费额度足够定时抓取 |
| 定时抓取      | Actions `schedule` cron                  | 无需额外付费 cron / 常驻服务器        |
| 数据存储      | 仓库内 `data/` 静态快照                  | 无数据库费用                          |
| 订阅分发      | Netlify 静态站点（必要时再加 Functions） | 免费额度覆盖静态 RSS/iCal             |
| 语言          | TypeScript（Node 20+）                   | 与 Netlify / Actions 生态契合         |

## 工作方式

1. 每个功能先拆成 Trellis 任务（写清 PRD）
2. 同步创建 GitHub Issue，并挂到 Project Dashboard
3. 小步修改、每次小改动单独 commit
4. CI 跑 lint / typecheck / test；通过后再合并

详细约定见 `.trellis/spec/` 与 `docs/architecture.md`。

## 仓库与进度

- GitHub: https://github.com/swsoyee/gbc-news
- Project Dashboard: https://github.com/users/swsoyee/projects/1
- CI: GitHub Actions（`CI` workflow）
- 部署目标: Netlify（仓库已含 `netlify.toml`，需在 Netlify 控制台连接本仓库）

## 本地开发（骨架阶段）

```bash
npm install
npm run lint
npm run typecheck
npm test
```

业务代码尚未实现；当前仓库先完成工程基础与工作流。

## Trellis

本仓库已用 `trellis init --cursor` 初始化。常用入口：

- `.trellis/workflow.md` — 开发流程
- `.trellis/spec/` — 编码规范
- `.trellis/tasks/` — 任务与 PRD

## 许可证

待定。
