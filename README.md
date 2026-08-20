# dsh-visualization

Secure optional Mermaid, data-table, and Vega-Lite rendering for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web.

It is a GitHub-distributed DSH bundle, not a shell modification. Without it, assistant fences remain ordinary copyable code blocks.

## Install

```bash
dsh plugin --profile web add github:shaomingbo/dsh-visualization#v0.1.0
```

Or run the package installer:

```bash
npx --yes github:shaomingbo/dsh-visualization#v0.1.0
```

Restart `npx @deepseek-ai/dsh web`, then hard-refresh the browser. To update:

```bash
dsh plugin --profile web update dsh-visualization
```

To remove it:

```bash
dsh plugin --profile web remove dsh-visualization
```

## Host requirement

Use a DSH release that provides the session-keyed `conversation.chat.assistant.codeBlock` slot and serves plugin companion JavaScript assets under `/plugins/<id>/`. Older published DSH versions render all fences as source code.

## Supported content

| Fence | Behavior |
|---|---|
| `mermaid` | Mermaid diagrams with a beautiful-mermaid-inspired two-color system, `neo` layout, DSH light/dark tokens, rounded surfaces, fine borders, and soft shadows. |
| `kanban`, `quadrantChart`, `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`, `requirementDiagram` | Direct Mermaid subtype fences. The body may omit the diagram header; the renderer adds it privately while preserving the original source for copy/display. |
| `text` | Compatibility routing only: a block is treated as Mermaid when its first non-empty line is a supported Mermaid header. Ordinary text blocks keep the native code fallback. |
| `csv`, `tsv`, `json-table` | Filterable, sortable, paginated native table. |
| `vega-lite` | Static inline-only Vega-Lite v6 chart in a one-shot Worker. |

Mermaid also supports flowchart/graph, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, mindmap, timeline, gitGraph, and journey. `xychart-beta` and `sankey-beta` are intentionally not enabled.

### Direct subtype examples

Fence languages are matched case-insensitively by DSH. These bodies intentionally omit the repeated Mermaid header:

````markdown
```kanban
backlog[Backlog]
  theme[Theme upgrade]
doing[In progress]
  dark[Dark-mode verification]
```

```quadrantChart
x-axis Low effort --> High effort
y-axis Low impact --> High impact
Dark mode: [0.35, 0.82]
```

```C4Context
Person(user, "User")
System(app, "DSH Web")
Rel(user, app, "Uses")
```

```requirementDiagram
requirement dark_mode {
id: "REQ-1"
text: "Readable in both color schemes"
risk: medium
verifymethod: test
}
```
````

The palette is recalculated when the DSH theme changes. If host tokens are unavailable, light and dark zinc fallbacks keep text, nodes, boundaries, and connectors readable. C4 diagrams use a compact three-column layout; when unsafe embedded person icons are removed, their labels are moved into the freed space instead of leaving a large visual gap.

## Security

- Rich rendering starts only after an assistant message settles; streaming stays plain code.
- Mermaid rejects directives, active links/callbacks, arbitrary HTML labels, remote resources, and unsafe CSS. C4 embedded image icons are stripped; text and shapes remain.
- SVG is sanitized, structurally checked, locally ID-prefixed, serialized into a Blob, and shown through `<img>`; no raw SVG enters the document.
- Vega-Lite runs in a disposable Worker with AST interpretation, a deny-all loader, bounded input/output, and a two-second termination deadline.
- No network fonts, external data, image loads, or raw HTML are enabled.

## Artifact size

The checked-in browser artifact intentionally contains the Mermaid/DOMPurify/css-tree/table implementation (~7.4 MB uncompressed). The optional Vega worker is a separate self-contained artifact (~1.8 MB). Neither is present until this optional package is installed.

## Development

```bash
npm test
npm run check
npm pack --dry-run
```

The `lib/` directory is committed on purpose: GitHub/pnpm installs consume prebuilt artifacts and do not build the plugin during profile installation. `lib/` is the release authority; `src/` is retained as readable source reference, not a standalone build interface. The package exposes no TypeScript integration API: its supported integration is the DSH bundle metadata and code-block slot. When changing source, regenerate both browser artifacts with the matching DSH client packaging tool and review the resulting `lib/` diff before tagging.

## License

MIT. Derived DSH source retains the upstream DeepSeek copyright notice.
