# gbc-news

定时从官网抓取资讯，并向用户提供 **RSS** 与 **iCal** 订阅接口。

当前已合并三源：

- [ガールズバンドクライ 公式 NEWS](https://girls-band-cry.com/news/)
- [FIRST RIFF](https://gbc-firstriff.com/)
- [collabo-cafe（GBC 相关）](https://collabo-cafe.com/)

支持按**组合**与**分类**筛选订阅；首页提供月 / 周 / 日活动日历（纯静态，无前端框架）。

## 目标

- 低成本：优先使用免费额度（GitHub Actions 定时任务 + Netlify 静态托管）
- 可订阅：稳定输出 RSS / iCal，并支持按组合 × 分类过滤
- 可维护：用 Trellis 管理规格与任务，用 GitHub Issues + Project 管理进度

## 使用

### 本地命令

```bash
npm install
npm test
npm run scrape              # 三源编排（单源失败隔离）；默认增量
npm run scrape:gbc          # 单源；全量用 SCRAPE_MODE=full
npm run scrape:firstriff
npm run scrape:collabo-cafe
npm run build:feeds         # 生成 public/feeds/*.xml|*.ics 与 public/data/news.json
npm run build:function      # 打包 Netlify Function
npm run build:web           # 打包 public/subscribe-core.js（前端纯函数）
```

本地预览静态页：

```bash
npx serve public -l 3000
```

打开首页后可：

- 勾选组合 / 分类，复制组合订阅或分类静态源
- 浏览活动日历（月 / 周 / 日）
- 多维交叉筛选走 `/api/feed?format=rss|ics&groups=…&categories=…`（需 Netlify Function）
- 也可直接使用静态源：`/feeds/all.xml`、`/feeds/live.ics`、`/feeds/group-togenashi.ics` 等

### 分类与组合

官网页面本身不暴露统一分类。本站按标题/正文关键词自动打标（一文可多类）：

`live` / `event` / `goods` / `music` / `cinema` / `media` / `other`

组合标签：`togenashi` / `f272` / `canna-lily` / `other`

## 技术选型（低成本）

| 能力          | 方案                                      | 成本考量                              |
| ------------- | ----------------------------------------- | ------------------------------------- |
| 代码托管 / CI | GitHub + GitHub Actions                   | 公开仓库 Actions 免费额度足够定时抓取 |
| 定时抓取      | Actions `Scrape` cron（日本时间 12:00 / 22:00） | 无需额外付费 cron / 常驻服务器  |
| 数据存储      | 仓库内 `data/` 静态快照                   | 无数据库费用                          |
| 订阅分发      | Netlify 静态 feeds + Function 过滤        | 免费额度覆盖                          |
| 前端          | `public/` 静态 HTML/CSS/JS + 可测纯函数   | 不引入 React/Vue                      |
| 语言          | TypeScript（Node 20+）                    | 与 Netlify / Actions 生态契合         |

## 工作方式

1. 每个功能先拆成 Trellis 任务（写清 PRD）
2. 同步创建 GitHub Issue，并挂到 Project Dashboard
3. 小步修改、每次小改动单独 commit
4. CI 跑 lint / typecheck / test；通过后再合并

详细约定见 `.trellis/spec/` 与 `docs/architecture.md`。

## 仓库与进度

- GitHub: https://github.com/swsoyee/gbc-news
- Project Dashboard: https://github.com/users/swsoyee/projects/1
- CI: GitHub Actions（`CI` + 定时增量 `Scrape`：每天日本时间 12:00 / 22:00）
- 生产站点: https://gbc-news.netlify.app
- Admin: https://app.netlify.com/projects/gbc-news

## Trellis

本仓库已用 `trellis init --cursor` 初始化。常用入口：

- `.trellis/workflow.md` — 开发流程
- `.trellis/spec/` — 编码规范
- `.trellis/tasks/` — 任务与 PRD

## 许可证

待定。
