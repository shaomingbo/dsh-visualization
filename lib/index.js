//#region src/index.ts
/** Services required for the model guidance paired with the browser renderers. */
const inject = ["systemPrompt"];
const DATA_TABLE_PROMPT = "Use fenced `csv`, `tsv`, or `json-table` blocks for tabular data that should render as a table. For `json-table`, write exactly valid JSON in one of three shapes: an array of flat objects `[{\"Column\":\"Value\"}]`, an object shaped as `{\"columns\":[\"Column\"],\"rows\":[[\"Value\"]]}`, or an array of row arrays whose first row is the header (`[[\"Column\"],[\"Value\"]]`). Never emit brace-comma pseudo-objects like `{\"A\",\"B\"}` — they are not JSON and fail to render. Keep ordinary JSON in `json` fences so it remains code.";
const MERMAID_PROMPT = "Use fenced Mermaid code blocks only when a diagram materially improves the answer. Allowed Mermaid families are flowchart/graph, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, mindmap, timeline, gitGraph, journey, kanban, quadrantChart, C4Context, C4Container, C4Component, C4Dynamic, C4Deployment, and requirementDiagram. Use a `mermaid` or matching subtype fence, never a `text` fence; a subtype fence body may omit its repeated header. Use conservative Mermaid 11 syntax. In flowcharts, use pipe-form edge labels such as `A -->|label| B` or `A -.->|label| B`; do not place free text inside link operators. Quote punctuation-heavy node labels as `A[\"label\"]`, especially paths or text containing slashes, dots, parentheses, or colons. In timelines, period text before `:` must not itself contain a colon; write times as `09：45` or `09点45分`. Keep labels plain text and do not insert HTML such as `<br>`. C4 diagrams render without embedded icons, so prefer short Person/System/Container/Component labels. Requirement blocks must use Mermaid 11 fields `id`, `text`, `risk`, and `verifymethod`; do not use `as` aliases or `testcase` blocks. Do not use frontmatter, directives, HTML labels, click or href links and callbacks, classDef, linkStyle, or style declarations.";
const VEGA_LITE_PROMPT = "Use fenced `vega-lite` code blocks for static charts. Write inline-only Vega-Lite v6 JSON using only arc, area, bar, boxplot, circle, errorband, errorbar, geoshape, line, point, rect, rule, square, text, tick, or trail marks. You may set `$schema` to `https://vega.github.io/schema/vega-lite/v6.json`; it is metadata only and is not fetched. Do not use remote data, image marks, url/href, params/selection/bind, events/signals, authored expressions, or transforms other than aggregate, bin, joinaggregate, sample, stack, timeunit, and window. Limits: 64 KiB source; JSON depth 32 and 20,000 nodes; 5,000 inline rows and 50,000 cells; 8 KiB strings; 32 views and 32 transforms; 20,000 estimated marks; width/height at most 1,000 and area at most 1,000,000.";
const DSH_SVG_PROMPT = "Reserve fenced `dsh-svg` blocks for polished, presentation-grade static diagrams, and use them only when the user explicitly asks for a refined diagram (e.g. \"精排图\", \"用于展示\", \"按 diagram-design 绘制\") or the `dsh-diagram-design` skill is loaded. Ordinary flow, sequence, and relationship diagrams stay in Mermaid; numeric charts stay in `vega-lite`; detail data stays in tables. Never take over ordinary `html`, `svg`, or `xml` blocks, and never put Mermaid or Vega-Lite inside a `dsh-svg` block. Protocol: exactly one complete SVG root `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"x y w h\">` with a positive finite decimal viewBox; `<title>` as the first child plus `<desc>`; only these elements inside: g, rect, circle, ellipse, line, polyline, polygon, path, text, tspan, title, desc, defs, marker. Style only through SVG presentation attributes (fill, stroke, stroke-dasharray, stroke-width, opacity, transform, font-family, font-size, font-weight, text-anchor). Forbidden: HTML shells, Markdown nesting, `<style>` or style/class attributes, scripts, event attributes, foreignObject, image, use, links, animation, filters, XML comments, backslash escape sequences in attribute values, external or remote references of any kind; the only permitted `url(#id)` is marker-start/marker-mid/marker-end pointing at a local `<marker>` definition. Use plain decimal numbers for all coordinates and sizes, keep ids unique, use system font stacks with Chinese fallbacks (e.g. `-apple-system, \"PingFang SC\", \"Microsoft YaHei\", sans-serif`), author fixed light background and colors into the SVG (the preview frame follows the DSH theme, the artwork does not), and break long Chinese labels into multiple `<text>` lines instead of shrinking the font. The renderer rejects invalid documents and falls back to showing the source.";
/**
* Register model guidance for all visualization fence renderers.
* @param ctx - host context carrying the system-prompt registry.
*/
function apply(ctx) {
	ctx.systemPrompt.section({
		name: "ui:data-table-fences",
		order: 185,
		text: DATA_TABLE_PROMPT
	});
	ctx.systemPrompt.section({
		name: "ui:mermaid",
		order: 190,
		text: MERMAID_PROMPT
	});
	ctx.systemPrompt.section({
		name: "ui:vega-lite",
		order: 190,
		text: VEGA_LITE_PROMPT
	});
	ctx.systemPrompt.section({
		name: "ui:dsh-svg",
		order: 191,
		text: DSH_SVG_PROMPT
	});
}
//#endregion
export { apply, inject };
