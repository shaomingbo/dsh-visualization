# dsh-visualization

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 的安全可选 Mermaid、数据表、Vega-Lite 和静态 `dsh-svg` 图示渲染 bundle，并随包分发按需加载的 `dsh-diagram-design` 精排图示 skill。

它通过 GitHub 分发，不修改 DSH shell。本包未安装时，assistant fence 保持为可复制的普通代码块。

## 安装

首选固定 Release 的安装器；不带命令时默认安装到 `web` profile：

```bash
npx --yes github:shaomingbo/dsh-visualization#v0.3.2
```

使用同一固定版本查看状态或卸载：

```bash
npx --yes github:shaomingbo/dsh-visualization#v0.3.2 status
npx --yes github:shaomingbo/dsh-visualization#v0.3.2 uninstall
```

本地开发时保持安装器版本固定，只覆盖插件来源：

```bash
npx --yes github:shaomingbo/dsh-visualization#v0.3.2 install \
  --source link:/absolute/path/to/dsh-visualization
```

安装器支持 `--profile`、`--source` 和 `--help`。安装与卸载委托给宿主官方的 `dsh plugin` 管理命令（它会初始化缺失的 profile 并维护 bundle 清单）；安装器只依据退出状态和 profile manifest 校验结果，不直接改写 manifest。`status` 为只读。在没有 `dsh` CLI 的机器上、或 CLI 版本不在已验证矩阵内时，安装/卸载会给出引导并失败，不做任何写入。安装器从不重启 DSH。安装或卸载后请手动重启 DSH，并强制刷新现有 Web GUI。

**已验证的安装器矩阵：** `dsh` CLI `0.1.2-alpha.3` 搭配 DSH web/base `0.1.2-rc.1`（全新 profile 安装、幂等重装、status、幂等卸载与引导失败路径，均在隔离 `DSH_HOME` 中实测）。其余 CLI 版本在验证前会被明确拒绝；`dsh plugin` 依赖 `PATH` 上的 `pnpm`。

手动 CLI 等价命令（安装器实际执行的命令）：

```bash
dsh plugin --profile web add github:shaomingbo/dsh-visualization#v0.3.2 --config.ignore-scripts=true
dsh plugin --profile web remove dsh-visualization --config.ignore-scripts=true
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
| `dsh-svg` | 模型手写的完整静态 SVG 文档，经独立白名单校验后以 Blob `<img>` 展示；详见下文"静态 dsh-svg 通道"。 |

Mermaid 还支持 flowchart/graph、sequenceDiagram、classDiagram、stateDiagram-v2、erDiagram、gantt、pie、mindmap、timeline、gitGraph 和 journey。`xychart-beta`、`sankey-beta` 暂不启用。普通 `html`、`svg`、`xml` 代码块不会被本插件接管，仍保持源码展示。

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

## 静态 dsh-svg 通道

`dsh-svg` 面向"精排、展示级"的手排图示：模型直接输出一个完整的静态 SVG 文档，不走 Mermaid/Vega-Lite 渲染器。何时使用：

- 常规流程、时序、关系说明 → 仍用 Mermaid（默认）。
- 数值图表、趋势对比 → 用 `vega-lite`。
- 明细数据 → 用表格。
- 用户明确要求"精排图""用于展示""按 diagram-design 绘制"，或加载了 `dsh-diagram-design` skill → 输出 `dsh-svg`。

最小示例：

````markdown
```dsh-svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" role="img" aria-labelledby="demo-title demo-desc">
  <title id="demo-title">架构总览</title>
  <desc id="demo-desc">客户端经网关访问订单服务，订单服务读写数据库。</desc>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#4f5d75"/>
    </marker>
  </defs>
  <rect width="960" height="600" fill="#f5f5f5"/>
  <rect x="80" y="120" width="160" height="48" rx="6" fill="#ffffff" stroke="#2d3142"/>
  <text x="160" y="148" text-anchor="middle" font-size="12" fill="#2d3142"
        font-family="-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif">客户端</text>
  <rect x="480" y="120" width="160" height="48" rx="6" fill="#ffffff" stroke="#2d3142"/>
  <text x="560" y="148" text-anchor="middle" font-size="12" fill="#2d3142"
        font-family="-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif">订单服务</text>
  <path d="M 240 144 H 472" fill="none" stroke="#4f5d75" marker-end="url(#arrow)"/>
</svg>
```
````

协议要点（渲染器强制校验，违反时预览失败并保留完整源码）：

- 有且仅有一个 SVG 根；`viewBox` 必填且宽高为正；`<title>` 是第一个子元素，`<title>`/`<desc>` 非空。
- 元素白名单：`g`、`rect`、`circle`、`ellipse`、`line`、`polyline`、`polygon`、`path`、`text`、`tspan`、`title`、`desc`、`defs`、`marker`。
- 只允许 SVG presentation attributes；禁止 `<style>`/`style`/`class`、脚本、事件属性、`foreignObject`、`image`/`use`/链接、动画、滤镜、外部或 `data:`/`blob:` 引用。
- `url(#id)` 仅限 `marker-start/mid/end` 且必须指向文档内 `<marker>`；id 必须唯一，`aria-labelledby` 等 IDREF 必须可解析（清洗时统一加前缀重写，引用关系保持有效）。
- 资源限额：源 ≤ 128 KiB、元素 ≤ 20,000、嵌套 ≤ 32 层、单属性值 ≤ 8 KiB、单文本节点 ≤ 4 KiB、viewBox 分量 ≤ 20,000。
- 配色与背景写死在 SVG 内（固定浅色纸底）；预览外框跟随 DSH 主题，深浅切换不触发重绘，也不发起任何字体/图片网络请求。

复制保留原始源码；下载保存的是校验后的 SVG。

## dsh-diagram-design skill

本包内置按需加载的 `dsh-diagram-design` skill（[diagram-design](https://github.com/cathrynlavery/diagram-design) 上游 commit `562dbdf` 的 DSH 适配版）：

- 通过宿主 skill 注册表（`ctx.skills`）以打包 provider 形式分发，**不写入**用户 `skills` 目录，不覆盖用户自定义 skill（同名时用户/项目 skill 优先），卸载插件即随之消失。
- skill 被发现和加载不依赖任何模型调用；`skills` 服务缺失的宿主组合会跳过该 skill 条目，可视化插件本身不受影响。
- 适配版固定输出 `dsh-svg`（静态、系统字体含中文回退、固定浅色配色），上游 HTML/外部字体/动画规则已被适配层覆盖；上游参考资料按固定 commit 原文随包分发于 `skill/dsh-diagram-design/references/`，来源与改动清单见同目录 `PROVENANCE.md`，上游 MIT 许可证副本见 `LICENSE`。
- 触发方式：会话中说"用 dsh-diagram-design 画…"、"画一张精排/展示级架构图"，模型会按会话 skill 目录加载该 skill 后输出 `dsh-svg`。也可在消息中直接 `/dsh-diagram-design` 调用。

## 安全

- 富渲染只在 assistant 消息结算后启动；流式内容始终显示普通代码。兼容适配器不会删除 Host DOM，并在卸载时恢复原代码块。
- Mermaid 拒绝指令、活动链接/回调、任意 HTML 标签、远程资源和危险 CSS。旧内容中的 `<br/>` 标签只会在私有渲染输入中转换为惰性分隔文本，复制的源码保持不变。C4 内嵌图标会被剥离，文字和形状保留。
- SVG 会经净化、结构校验、本地 ID 前缀化后序列化为 Blob，并通过 `<img>` 显示；原始 SVG 不进入文档。`dsh-svg` 走独立的白名单策略（输入约束 → 结构校验 → DOM 白名单重写 → 输出重校验），不继承 Mermaid 的样式/滤镜规则。
- Vega-Lite 在一次性 Worker 中运行，使用 AST 解释、拒绝所有加载器、输入/输出限制和两秒终止期限。`$schema` 仅接受官方 v6 schema URL，纯元数据，从不发起网络请求。
- 不启用网络字体、外部数据、图片请求或原始 HTML。

## Artifact 大小

已提交的浏览器 artifact 有意包含 Mermaid/DOMPurify/css-tree/表格实现（未压缩约 7.4 MB）。可选 Vega Worker 是单独的自包含 artifact（约 1.7 MB）。未安装本包时，这些代码不会出现在 DSH 中。

## 开发

```bash
npm test
npm run check
npm pack --dry-run
```

`lib/` 被有意提交：GitHub/pnpm 安装消费预构建 artifact，不在 profile 安装期构建插件。`lib/` 是发布权威；`src/` 为源码，修改后运行 `npm run build`（rolldown + lightningcss，见 `scripts/build.mjs`）重新生成全部 `lib/` artifact，并在打 tag 前审阅 diff。本包不暴露 TypeScript 集成 API；受支持的集成面是 DSH bundle metadata 与按能力选择的原生/兼容浏览器适配器，以及随包 skill 的宿主注册表条目。

## 许可证

MIT。衍生的 DSH 源码保留上游 DeepSeek 版权声明。`skill/dsh-diagram-design/` 中的上游参考资料与许可证来自 cathrynlavery/diagram-design（MIT, Copyright (c) 2025 Cathryn Lavery）。
