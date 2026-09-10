# Provenance — dsh-diagram-design

## 上游来源

- 项目：[cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)
  "38 editorial diagram types for Claude Code, Codex, and Pi. Self-contained HTML + SVG."
- 固定 commit：`562dbdf93ff3c3da630be4f90f4f6c2548175058`（main 分支 HEAD，2026-09-10；tree `183b6023e403513525fa12c03d0e3fe7bfdb14fb`）
- 上游许可：MIT License，Copyright (c) 2025 Cathryn Lavery。原文副本见本目录 `LICENSE`。

## 本目录内容与对应关系

| 本地文件 | 上游文件 | 处理方式 |
|---|---|---|
| `SKILL.md` | `skills/diagram-design/SKILL.md`（v2.6） | **重写为 DSH 适配层**：输出协议改为 `dsh-svg`；静态化；系统字体；固定浅色 skin；跳过品牌 onboarding；新增工程图保真规则。仅少量上游文字（协议条目、token 表、连线规则摘要）经翻译/摘编后收录。 |
| `references/*.md`（20 个） | `skills/diagram-design/references/` 同名文件 | **逐字原文**，未改动。 |
| `LICENSE` | `LICENSE`（仓库根） | 逐字原文。 |

未随包分发的上游材料（如需可从固定 commit 自取）：`SKILL.md` 原文、`assets/`（162 个 HTML 模板/示例）、`scripts/`（self_check.py、drawio/mermaid/excalidraw 提取器）、`commands/`、`references/` 其余 36 个文件（animation、export、import-*、onboarding、profiles、doctor、export-registry、primitive-icons/sketchy/terminal，以及未收录的 30 个 type-*）。

### references 收录范围（工程图导向的固定子集）

`style-guide.md`、`semantic-patterns.md`、`output-spec.md`、`primitive-annotation.md`、`type-architecture.md`、`type-flowchart.md`、`type-sequence.md`、`type-state.md`、`type-er.md`、`type-swimlane.md`、`type-tree.md`、`type-layers.md`、`type-org-chart.md`、`type-timeline.md`、`type-dependency.md`、`type-deployment.md`、`type-db-schema.md`、`type-data-flow.md`、`type-fishbone.md`、`type-uml-class.md`（共 20 个）。

数值图表类型（bar/line/scatter/radar/quadrant/waterfall/treemap 等）未收录：DSH 路由中数值图表由 `vega-lite` 通道承担，不由本技能承担，也不构成对上游全部图类型的兼容承诺。

## 适配层改动明细（SKILL.md 相对上游的实质差异）

1. 输出物从“自包含 HTML + 内联 SVG”改为单个 `dsh-svg` 围栏代码块，协议条款与 dsh-visualization 渲染器校验一一对应（元素/属性白名单、viewBox、title/desc、id 唯一性、marker 本地引用、资源限额）。
2. 禁止远程字体/图标/动画/脚本，字体映射为系统栈（含中文回退），颜色为写死的具体值（不依赖宿主 CSS/currentColor）；DSH 深浅主题切换不触发重绘。
3. 删除品牌 onboarding 门禁（上游 §0）与 profiles/onboarding 流程，提供开箱默认 skin。
4. 新增工程图保真规则章节：保真优先于上游的删除哲学；超预算拆“总览+细节”；合并/省略必须图外说明；中文长标签换行而非缩字号。
5. 类型索引裁剪为已收录的 references 子集，明确数值图表路由到 vega-lite。
6. 尺寸预设保留上游 output-spec 的 viewBox 定义；“始终先产 HTML”改为直接产出 `dsh-svg`。

## 升级方式

固定 commit，不在运行时拉取上游 main。升级时：更新 pinned commit、重新 diff `references/`、按需更新适配层，并同步本文件与 README。
