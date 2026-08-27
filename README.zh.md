# dsh-visualization

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 的安全可选 Mermaid、数据表和 Vega-Lite 渲染 bundle。

它通过 GitHub 分发，不修改 DSH shell。本包未安装时，assistant fence 保持为可复制的普通代码块。

## 安装

首选固定 Release 的安装器；不带命令时默认安装到 `web` profile：

```bash
npx --yes github:shaomingbo/dsh-visualization#v0.2.5
```

使用同一固定版本查看状态或卸载：

```bash
npx --yes github:shaomingbo/dsh-visualization#v0.2.5 status
npx --yes github:shaomingbo/dsh-visualization#v0.2.5 uninstall
```

本地开发时保持安装器版本固定，只覆盖插件来源：

```bash
npx --yes github:shaomingbo/dsh-visualization#v0.2.5 install \
  --source link:/absolute/path/to/dsh-visualization
```

安装器支持 `--profile`、`--source` 和 `--help`。它只原子修改本插件的依赖与 bundle 条目，然后执行 `pnpm install --ignore-scripts`，不会重启 DSH。安装或卸载后请手动重启 DSH，并强制刷新现有 Web GUI。

手动 CLI 兜底：

```bash
dsh plugin --profile web add github:shaomingbo/dsh-visualization#v0.2.5
dsh plugin --profile web remove dsh-visualization
```

## Host 兼容性

插件按 Host 能力选择适配器。提供 session/keyed `conversation.chat.assistant.codeBlock` 插槽的版本走原生渲染 seam；能够在 `/plugins/<id>/` 下提供 companion JavaScript、但缺少该插槽的已发布 rc.2 Host 走失败开放的 DOM 兼容适配器：它只观察已结算代码块，在 Host 源码旁挂载同一套安全渲染器，并且仅在有效预览出现后隐藏 Host 代码块。未知 DOM、流式内容、解析失败和渲染失败都会保留原始源码。当前模式可通过 `document.documentElement.dataset.dshVisualizationAdapter` 在本地诊断。

## 支持内容

| Fence | 行为 |
|---|---|
| `mermaid` | Mermaid 图表，采用 beautiful-mermaid 风格的双基色体系、`neo` 布局、DSH 明暗 token、圆角表面、细描边和柔和阴影。 |
| `kanban`、`quadrantChart`、`C4Context`、`C4Container`、`C4Component`、`C4Dynamic`、`C4Deployment`、`requirementDiagram` | 直接使用 Mermaid 子类型 fence。正文可省略图表 header；渲染器只在内部补齐，源码展示与复制仍保留原文。 |
| `text` | 仅用于兼容：只有首个非空行是已支持的 Mermaid header 时才进入渲染器；普通文本块仍使用原生代码 fallback。 |
| `csv`、`tsv`、`json-table` | 可过滤、排序、分页的原生表格。 |
| `vega-lite` | 在一次性 Worker 中渲染静态、仅内联数据的 Vega-Lite v6 图表。 |

Mermaid 还支持 flowchart/graph、sequenceDiagram、classDiagram、stateDiagram-v2、erDiagram、gantt、pie、mindmap、timeline、gitGraph 和 journey。`xychart-beta`、`sankey-beta` 暂不启用。

复杂图表可按 SVG 原始尺寸打开大图预览。大图支持 10%～300% 缩放、适应窗口、滚动条、鼠标/触摸拖拽平移、键盘缩放（`+`、`-`、`0`），并可通过 `Escape` 或点击空白区域关闭。

### 直接子类型示例

DSH 对 fence language 使用不区分大小写的匹配。以下正文有意省略重复的 Mermaid header：

````markdown
```kanban
backlog[待办]
  theme[升级主题]
doing[进行中]
  dark[验证暗夜模式]
```

```quadrantChart
x-axis 低投入 --> 高投入
y-axis 低影响 --> 高影响
暗夜模式: [0.35, 0.82]
```

```C4Context
Person(user, "用户")
System(app, "DSH Web")
Rel(user, app, "使用")
```

```requirementDiagram
requirement dark_mode {
id: "REQ-1"
text: "明暗主题下均清晰可读"
risk: medium
verifymethod: test
}
```
````

DSH 主题变化时会重新计算调色板；即使宿主 token 暂不可用，明暗两套 zinc fallback 也会保证文字、节点、边界和连线可读。C4 默认使用紧凑三列布局；安全层移除人物内嵌图标后会同步上移标签，不再留下大块空白。

## 安全

- 富渲染只在 assistant 消息结算后启动；流式内容始终显示普通代码。兼容适配器不会删除 Host DOM，并在卸载时恢复原代码块。
- Mermaid 拒绝指令、活动链接/回调、任意 HTML 标签、远程资源和危险 CSS。旧内容中的 `<br/>` 标签只会在私有渲染输入中转换为惰性分隔文本，复制的源码保持不变。C4 内嵌图标会被剥离，文字和形状保留。
- SVG 会经净化、结构校验、本地 ID 前缀化后序列化为 Blob，并通过 `<img>` 显示；原始 SVG 不进入文档。
- Vega-Lite 在一次性 Worker 中运行，使用 AST 解释、拒绝所有加载器、输入/输出限制和两秒终止期限。
- 不启用网络字体、外部数据、图片请求或原始 HTML。

## Artifact 大小

已提交的浏览器 artifact 有意包含 Mermaid/DOMPurify/css-tree/表格实现（未压缩约 7.4 MB）。可选 Vega Worker 是单独的自包含 artifact（约 1.8 MB）。未安装本包时，这些代码不会出现在 DSH 中。

## 开发

```bash
npm test
npm run check
npm pack --dry-run
```

`lib/` 被有意提交：GitHub/pnpm 安装消费预构建 artifact，不在 profile 安装期构建插件。`lib/` 是发布权威；`src/` 仅保留为可读源码参考，不是独立支持的构建接口。本包不暴露 TypeScript 集成 API；受支持的集成面是 DSH bundle metadata 与按能力选择的原生/兼容浏览器适配器。修改源码时，须使用匹配的 DSH client 打包工具重新生成两个浏览器 artifact，并在打 tag 前审阅产生的 `lib/` diff。

## 许可证

MIT。衍生的 DSH 源码保留上游 DeepSeek 版权声明。
