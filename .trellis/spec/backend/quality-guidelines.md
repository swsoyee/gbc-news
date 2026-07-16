# 后端质量规范

## 必须

- TypeScript `strict`
- 解析逻辑有夹具测试（fixture HTML/JSON → 期望 `Item[]`）
- feed 生成有快照或结构化断言（标题、uid、时间字段）
- 公共函数有明确输入输出类型，不导出模糊 `any`
- 遵守低成本架构：定时在 Actions，分发在 Netlify 静态（见 `docs/architecture.md`）

## 禁止

- 提交未使用的依赖「以后可能用」
- 在 scraper 里直接拼 RSS/iCal 字符串（必须经统一模型 + feeds 层）
- 硬编码仅本机可用的绝对路径
- 绕过 lint / typecheck / format / test 合入（`--no-verify` 除非任务明确要求）
- **本地 `npm run ci` 未通过就 `git push`**（见 `.trellis/spec/guides/collaboration-and-delivery.md`）

## 代码评审关注点

1. 新源是否独立模块化
2. 失败是否可观测
3. 是否可能写出损坏/空订阅文件
4. 是否引入不必要的运行时成本

## 测试最小集

| 层级 | 最小覆盖 |
|------|----------|
| parse | 典型页、空列表、缺字段 |
| feeds | 单条、多条、时间排序 |
| http utils | 超时/错误映射（可用 mock） |
