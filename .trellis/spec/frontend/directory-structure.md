# 前端目录结构

## 推荐布局

```text
public/
  index.html          # 可选：订阅说明页
  feeds/
    news.xml          # RSS
    events.ics        # iCal
src/web/              # 仅当需要构建 UI 时存在
  main.ts
  styles.css
```

## 约定

1. **Feed 文件路径稳定**：对外 URL 一经发布尽量不改；改名需写迁移说明。
2. **页面只做发现与说明**：列出订阅链接、更新频率、来源说明；不做后台管理。
3. **优先零构建**：能用纯 HTML/CSS 就不要上 React/Vue。若后续确需组件化，再单独立项。

## 禁止

- 在首屏堆砌仪表盘卡片、统计条、无关营销模块
- 为静态说明页引入大型 UI 框架
- 把抓取逻辑放到浏览器端执行
