/**
 * Node half: registers model guidance for all visualization fence renderers.
 * Browser components, security surfaces, and heavy dependencies live exclusively
 * in the client half (lib/client.js); this module must never import React,
 * Mermaid, DOMPurify, or any browser-only dependency.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-system-prompt'

/** Services required for the model guidance paired with the browser renderers. */
export const inject = ['systemPrompt']

const DATA_TABLE_PROMPT = 'Use fenced `csv`, `tsv`, or `json-table` blocks for tabular data that should render as a table. For `json-table`, use either an array of flat objects or an object shaped as `{"columns":["Column"],"rows":[["Value"]]}`. Keep ordinary JSON in `json` fences so it remains code.'

const MERMAID_PROMPT = 'Use fenced Mermaid code blocks only when a diagram materially improves the answer. '
  + 'Allowed Mermaid families are flowchart/graph, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, mindmap, timeline, gitGraph, journey, kanban, quadrantChart, C4Context, C4Container, C4Component, C4Dynamic, C4Deployment, and requirementDiagram. '
  + 'Use a `mermaid` or matching subtype fence, never a `text` fence; a subtype fence body may omit its repeated header. '
  + 'Use conservative Mermaid 11 syntax. In flowcharts, use pipe-form edge labels such as `A -->|label| B` or `A -.->|label| B`; do not place free text inside link operators. Quote punctuation-heavy node labels as `A["label"]`, especially paths or text containing slashes, dots, parentheses, or colons. In timelines, period text before `:` must not itself contain a colon; write times as `09：45` or `09点45分`. Keep labels plain text and do not insert HTML such as `<br>`. '
  + 'C4 diagrams render without embedded icons, so prefer short Person/System/Container/Component labels. Requirement blocks must use Mermaid 11 fields `id`, `text`, `risk`, and `verifymethod`; do not use `as` aliases or `testcase` blocks. '
  + 'Do not use frontmatter, directives, HTML labels, click or href links and callbacks, classDef, linkStyle, or style declarations.'

const VEGA_LITE_PROMPT = 'Use fenced `vega-lite` code blocks for static charts. Write inline-only Vega-Lite v6 JSON using only arc, area, bar, boxplot, circle, errorband, errorbar, geoshape, line, point, rect, rule, square, text, tick, or trail marks. Do not use remote data, image marks, url/href, params/selection/bind, events/signals, authored expressions, or transforms other than aggregate, bin, joinaggregate, sample, stack, timeunit, and window. Limits: 64 KiB source; JSON depth 32 and 20,000 nodes; 5,000 inline rows and 50,000 cells; 8 KiB strings; 32 views and 32 transforms; 20,000 estimated marks; width/height at most 1,000 and area at most 1,000,000.'

/**
 * Register model guidance for all visualization fence renderers.
 * @param ctx - host context carrying the system-prompt registry.
 */
export function apply(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'ui:data-table-fences',
    order: 185,
    text: DATA_TABLE_PROMPT,
  })
  ctx.systemPrompt.section({
    name: 'ui:mermaid',
    order: 190,
    text: MERMAID_PROMPT,
  })
  ctx.systemPrompt.section({
    name: 'ui:vega-lite',
    order: 190,
    text: VEGA_LITE_PROMPT,
  })
}
