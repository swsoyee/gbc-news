# 协作与进度管理

## 小步提交

- 每次只做一件事：文档 / 配置 / 单源 scraper / 单 feed 等
- 每次小改动单独 `git commit`；提交信息说明**为什么**
- 不把无关文件塞进同一提交

## 任务拆分

1. 功能先写成 Trellis 任务（`prd.md` 写清范围与验收）
2. 大功能拆成可独立合并的子任务（父/子任务关联）
3. 同步创建 GitHub Issue，并加入 Project Dashboard
4. 开始做 → Issue 标为 In Progress；完成 → Done，并回写 Trellis 状态

## GitHub 同步

- Issue 标题与 Trellis 任务标题保持一致或可追溯
- Issue 正文链接到 `.trellis/tasks/<name>/prd.md`
- Project 看板列建议：`Backlog` / `Ready` / `In Progress` / `Done`

## Commit 前（强制）

1. **技术负债速查**：对照本次 diff，检查文档/spec 是否脱节、源注册是否遗漏、明显重复或校验缺口等。
   - 有债 → 先向用户给出修改建议并确认是否一并处理，再决定是否 commit。
   - 无债 → 继续。
2. **Lint / format**：运行 `npm run precommit`；未通过禁止 commit。

详见 `.cursor/rules/commit-must-lint.mdc`。

## Lint 与 CI（强制）

**推送前必须在本地跑通与 GitHub Actions 相同的检查，全部通过后才允许 `git push`。**

本地一键：

```bash
npm run ci
```

等价于依次执行：

1. `npm run lint`
2. `npm run format:check`
3. `npm run typecheck`
4. `npm test`

规则：

- `npm run ci` 失败时：**禁止 push**；先修复再提交
- 格式问题用 `npm run format` 自动修复后再跑 `npm run ci`
- GitHub Actions 对 PR 与 `main` 执行同样检查；本地已绿是默认前提，不是可选项
- 不允许用 `--no-verify` / 跳过 hook 的方式绕过检查合入主干（除非任务明确批准并记录原因）
