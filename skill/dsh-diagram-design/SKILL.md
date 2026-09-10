---
name: dsh-diagram-design
description: Polished, presentation-grade static engineering diagrams (architecture, flowchart, sequence, state, data flow, swimlane, deployment, dependency, ER, tree, layers, org chart, timeline, and related types) for DeepSeek Harness, rendered as a single fenced `dsh-svg` SVG code block. Use only when the user explicitly asks for a refined or presentation-grade diagram — e.g. "精排图", "用于展示", "精排", "按 diagram-design 绘制" — or when earlier conversation turns load this skill. Do not use for ordinary diagrams (DSH defaults to Mermaid), numeric charts (use `vega-lite`), or detail data (use tables).
license: MIT
metadata:
  upstream: "cathrynlavery/diagram-design"
  upstream-commit: "562dbdf93ff3c3da630be4f90f4f6c2548175058"
  adaptation: "dsh-visualization dsh-svg static channel"
---

# DSH Diagram Design（dsh-diagram-design）

这是 [diagram-design](https://github.com/cathrynlavery/diagram-design) 的 DSH 适配版：保留其信息组织、布局语法、连线规则、留白与视觉层次，把输出物改为 DeepSeek Harness 的 **`dsh-svg` 静态 SVG 协议**。上游参考资料按固定 commit 原文保留在 `references/`，来源与本地改动见 `PROVENANCE.md`。

## 0. 输出协议（最高优先级，覆盖上游一切输出规则）

**交付物是 `dsh-svg` 围栏代码块；每张图恰好一个代码块。** 内容超出预算时按 §2 拆成“总览 + 细节”多张图——即多个代码块，每个代码块独立成图，并在各自图外附说明。上游“自包含 HTML + 内联 SVG + CSS”的输出契约、模板/变体/动画/导出/字体链接，在 DSH 中一律不适用：

````
```dsh-svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" role="img" aria-labelledby="api-gateway-title api-gateway-desc">
  <title id="api-gateway-title">订单服务架构总览</title>
  <desc id="api-gateway-desc">架构图：客户端经 API 网关访问订单服务与支付服务，订单服务读写 PostgreSQL，支付失败进入重试队列。</desc>
  <rect width="960" height="600" fill="#f5f5f5"/>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#4f5d75"/>
    </marker>
  </defs>
  ...
</svg>
```
````

硬性约束（渲染器逐条强制校验，违反则预览失败并保留源码）：

- 有且仅有一个 SVG 根；`viewBox` 必须存在、四个十进制 SVG 数字、宽高为正。
- `<title>` 必须是 `<svg>` 的第一个子元素，且 `<title>`、`<desc>` 都要有非空文字；推荐 `role="img"` + `aria-labelledby` 指向二者（清洗时会统一重写 id，保持引用有效）。
- 只允许这些元素：`svg`、`g`、`rect`、`circle`、`ellipse`、`line`、`polyline`、`polygon`、`path`、`text`、`tspan`、`title`、`desc`、`defs`、`marker`。
- 样式只能用 SVG presentation attributes：`fill`、`stroke`、`stroke-width`、`stroke-dasharray`、`stroke-opacity`、`opacity`、`transform`、`font-family`、`font-size`、`font-weight`、`font-style`、`text-anchor`、`letter-spacing`、`dominant-baseline` 等。
- 禁止：`<style>`、`style`/`class` 属性、脚本、事件属性（`on*`）、`foreignObject`、`image`、`use`、`a` 链接、动画（`animate`/`set` 等）、滤镜、`clipPath`/`mask`/`pattern`/渐变、`href`/`xlink:href`/`src`、任何 `http(s)`/`data:`/`blob:`/`file:` 引用、DOCTYPE 与实体声明、**XML 注释与处理指令**（`references/` 示例中的注释仅作讲解，输出时必须删除）、**属性值中的反斜杠转义**（颜色、字体、引用一律写明文，不用 CSS/unicode 转义）。
- 数值一律用常规十进制 SVG 数字：`960`、`0.8`、`1e3` 合法；`0x64`、`1e100` 等非法。画布由 `viewBox`（各分量绝对值 ≤ 20000）与可选根 `width`/`height`（十进制正数，≤ 20000，不用百分比）决定；坐标与变换数值绝对值 ≤ 1,000,000；相对长度百分比数值绝对值 ≤ 5,000（渲染尺寸不超过画布坐标上限）。
- `url(#id)` 仅允许出现在 `marker-start`/`marker-mid`/`marker-end`，且必须指向文档内已定义的 `<marker>`（值两端的空白会被归一，不影响匹配）；所有 `id` 必须唯一。悬空的 marker 或 `aria-*` IDREF 引用会被拒绝。
- 图外的标题、解释、保真说明写在普通聊天正文里，不进代码块。

资源限制：源 ≤ 128 KiB；元素 ≤ 20,000；嵌套深度 ≤ 32；单个属性值 ≤ 8 KiB；单个文本节点 ≤ 4 KiB；viewBox 与根尺寸分量绝对值 ≤ 20,000；坐标/变换数值绝对值 ≤ 1,000,000；相对长度百分比数值绝对值 ≤ 5,000。

## 1. 与上游的关键差异（必须遵守，冲突时本节优先）

1. **静态图**：不使用动画、`prefers-reduced-motion` 逻辑、JS 控制器；上游 `animation.md` 不随本技能分发。
2. **无外部字体/图标**：不使用 Google Fonts、`<link>`、远程图标库。字体用系统栈：
   - 节点名/正文：`font-family="-apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"`
   - 技术子标签（端口、协议、URL）：`font-family="ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace"`（仅拉丁内容）
   - 上游的 Instrument Serif/Geist 仅在用户明确要求且已安装时使用；否则跳过，不降级为远程字体。
3. **固定浅色纸底与配色，写入 SVG**：默认 `paper=#f5f5f5`、`ink=#2d3142`、`muted=#4f5d75`、`soft=#7a8399`、`accent=#eb6c36`（1–2 个焦点元素）、`link=#2e5aa8`。背景 rect 必须铺满 viewBox。不要使用 `currentColor` 或依赖宿主 CSS 变量；DSH 深/浅主题切换只影响预览外框，不触发重绘。
4. **不做品牌 onboarding 门禁**：跳过上游 §0 的首次问答与 `profiles.md`/`onboarding.md` 流程，直接用默认 skin 出图；用户主动给品牌色时按语义角色映射后使用。
5. **无 assets/模板/脚本**：上游 `assets/*.html`、`scripts/*.py`、`commands/` 不随本技能分发；示例仅作布局参考，不产出 HTML 文件。
6. **不强制先 HTML 后 SVG**（覆盖 output-spec.md §1）：`dsh-svg` 代码块本身就是交付物。
7. **文本换行**：SVG `<text>` 不自动换行。中文长标签手动拆成多行 `<text>`/`<tspan>`：行距取字号的 1.2–1.4 倍，`dy` 等位移**必须按字号换算成无单位数值**（如 `font-size="16"`、行距 1.3 → `dy="20.8"`；校验只接受纯数字，`dy="1.3em"` 会被整图拒绝）；按“宽字符 1em、窄字符约 0.6em”预算宽度；禁止靠缩小字号塞进节点（中文正文字号下限 12px，`<desc>` 说明除外）。可直接套用的换行写法（`tspan` 继承 `text` 属性，`x` 归位、`dy` 累进下行）：

   ````
   ```dsh-svg
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" role="img" aria-labelledby="wrap-title wrap-desc">
     <title id="wrap-title">长标签示例</title>
     <desc id="wrap-desc">中文长标签换行示例：行距取字号的 1.3 倍，tspan 位移使用无单位数值。</desc>
     <rect width="960" height="600" fill="#f5f5f5"/>
     <rect x="370" y="252" width="220" height="76" rx="6" fill="#ffffff" stroke="#2d3142"/>
     <text x="480" y="282" text-anchor="middle" font-size="16" font-family="-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif" fill="#2d3142">用户携带过期票据<tspan x="480" dy="20.8">请求会话续签</tspan></text>
   </svg>
   ```
   ````

## 2. 工程图保真规则（覆盖上游“删除优先”哲学）

上游哲学是 "The highest-quality move is usually deletion"。在 DSH 中，**信息保真优先于美观**：

- **不能为好看静默删除节点、关系、异常分支、重试、回滚、鉴权条件或数据流。** 上游复杂度预算（≤9 节点等）用于布局密度控制，不是删内容许可：内容超出预算时，按上游 output-spec 的 degrade ladder 先合并副本、折叠叶子簇，仍然超了就拆成“总览 + 细节”两张图，在正文分别输出，而不是丢弃。
- 保留有意义的方向、条件与边标签（`POST /v2/orders`、`失败重试 ×3`、`仅内网`）；禁用路径必须画出并标明“禁止/被拒”，不能只靠颜色。
- 合并、折叠或省略任何内容时，必须在图外正文说明（上游 fidelity ledger 格式：Merged/Collapsed/Dropped/Kept）。
- 无法在不丢信息的前提下清晰表达时，说明问题并改用更合适的表现方式（表格、分步说明、Mermaid），不以精美图片掩盖信息丢失。
- 六条连线铁律（圆角直角连接、标签 6–10px 间隙、不重叠、分支扇出分流点、不穿非端点盒、遮罩不压后绘节点）与 4px 网格全部保留，见上游 SKILL.md §6/§7 与 `references/type-architecture.md`。

## 3. 工作流程

1. 判断类型：行为/状态/风控承载语义时先读 `references/semantic-patterns.md` 选模式；否则按下表选布局类型，**画前必读对应 type 参考**。
2. 在正文用一小段说明：所选类型、viewBox 尺寸、以及预算迫使你做的合并/拆分决定；用户未给约束时直接按默认出图并注明假设（DSH 中不等待确认）。
3. 按 `dsh-svg` 协议绘制：背景 rect → 区域（zone）→ 箭头（含 defs 中 marker）→ 节点盒 → 标签/图例；连线用圆角直角 elbow（`references/type-architecture.md` 的路径公式）与 bridge/hop。
4. 出图前自查 §4 清单；在正文附保真说明（如有合并/省略）。

### 类型参考索引（按需读取，位于本技能目录 `references/`）

| 要表达的内容 | 类型参考 |
|---|---|
| 组件 + 连接 + 分区/信任边界 | `references/type-architecture.md` |
| 判定逻辑分支（含失败/重试/回滚路径） | `references/type-flowchart.md` |
| 执行者间时序消息（鉴权/异常/回调） | `references/type-sequence.md` |
| 状态机 + 迁移条件 | `references/type-state.md` |
| 实体 + 关系 | `references/type-er.md` |
| 角色分工的数据流/管道 | `references/type-data-flow.md` |
| 跨职能流程/泳道交接 | `references/type-swimlane.md` |
| 部署拓扑/区域/副本 | `references/type-deployment.md` |
| 依赖图（扇入/环） | `references/type-dependency.md` |
| 层次树/组织结构 | `references/type-tree.md`、`references/type-org-chart.md` |
| 抽象层叠 | `references/type-layers.md` |
| 时间线 | `references/type-timeline.md` |
| 数据库物理表结构 | `references/type-db-schema.md` |
| 类结构 | `references/type-uml-class.md` |
| 根因鱼骨图 | `references/type-fishbone.md` |
| 编辑性旁注 | `references/primitive-annotation.md` |
| 完整设计 token | `references/style-guide.md` |
| 导入四拨盘（尺寸/细节/受众）与保真台账 | `references/output-spec.md` |

尺寸预设沿用上游 output-spec：默认 `0 0 960 600`（doc-inline）；内容为主时可推导 `fit`（内容包围盒向上取 4 的倍数 + 40px 边距 + 底部 60px 图例带）。

## 4. 出图检查清单

**协议：**
- [ ] 每张图恰好一个 `dsh-svg` 代码块（超预算时按 §2 拆分为多个代码块）；`viewBox` 合法；`<title>` 是第一个子元素且与 `<desc>` 均非空；id 唯一且被 `aria-labelledby`/marker 正确引用。
- [ ] 无任何禁止元素/属性/引用；配色与背景是写死的具体色值。
- [ ] 中文标签使用系统字体栈；字号 ≥ 12px；长文本已换行且不与连线/节点重叠。

**保真：**
- [ ] 用户描述的每个节点、关系、异常/重试/回滚/鉴权分支都在图中，或已在正文说明合并/省略方式。
- [ ] 禁用与失败路径可见且有文字标注。
- [ ] 超预算时已拆分“总览 + 细节”，未静默删减。

**布局：**
- [ ] 连线为圆角直角（同轴才用直线）；标签与连线有间隙且有不透明遮罩；交叉用 bridge/hop；同边多连线分流点分隔。
- [ ] 坐标/字号/间距符合 4px 网格；图例在底部独立条带。
- [ ] `accent` 只用于 1–2 个焦点元素。

## 5. 来源与许可

上游项目 [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)（MIT License, Copyright (c) 2025 Cathryn Lavery），本技能固定引用 commit `562dbdf93ff3c3da630be4f90f4f6c2548175058`。`references/` 内文件为上游原文；`SKILL.md`（本文件）与 `PROVENANCE.md` 是 DSH 适配层，随 dsh-visualization 以 MIT 许可分发。详见 `PROVENANCE.md`。
