# dsh-visualization

Secure optional Mermaid, data-table, Vega-Lite, and static `dsh-svg` diagram rendering for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web, with the on-demand `dsh-diagram-design` skill bundled.

It is a GitHub-distributed DSH bundle, not a shell modification. Without it, assistant fences remain ordinary copyable code blocks.

## Install

Use the fixed release installer. With no command it installs into the `web` profile:

```bash
npx --yes github:shaomingbo/dsh-visualization#v0.3.1
```

Check status or uninstall with the same pinned release:

```bash
npx --yes github:shaomingbo/dsh-visualization#v0.3.1 status
npx --yes github:shaomingbo/dsh-visualization#v0.3.1 uninstall
```

For local development, keep the installer pinned but override its package source:

```bash
npx --yes github:shaomingbo/dsh-visualization#v0.3.1 install \
  --source link:/absolute/path/to/dsh-visualization
```

The installer supports `--profile`, `--source`, and `--help`. Install and uninstall delegate to the official `dsh plugin` management command, which initializes a missing profile and maintains the bundle list; the installer only verifies the outcome (exit status plus the profile manifest) and never edits the manifest itself. `status` is read-only. On a machine without the `dsh` CLI, or with a CLI version outside the verified matrix, install/uninstall fail with guidance and change nothing. The installer never restarts DSH. Restart DSH manually after install or uninstall, then hard-refresh the existing Web GUI.

**Verified installer matrix:** `dsh` CLI `0.1.2-alpha.3` with DSH web/base `0.1.2-rc.1` (fresh-profile install, idempotent re-install, status, idempotent uninstall, and guidance failures were exercised against this matrix in an isolated `DSH_HOME`). Other CLI versions are intentionally rejected until verified; `pnpm` must be on `PATH` because `dsh plugin` forwards to it.

Manual CLI equivalent (what the installer runs):

```bash
dsh plugin --profile web add github:shaomingbo/dsh-visualization#v0.3.1 --ignore-scripts
dsh plugin --profile web remove dsh-visualization --ignore-scripts
```

## Host compatibility

The plugin selects its adapter by Host capability. Releases that provide the session-keyed `conversation.chat.assistant.codeBlock` slot use the native renderer seam. Published rc.2 Hosts that serve companion JavaScript under `/plugins/<id>/` but lack that slot use a fail-open DOM adapter: it observes settled code blocks, mounts the same secure renderer beside the Host source, and hides the Host block only after a valid preview exists. Unknown markup, streaming content, parse failures, and renderer failures keep the original source visible. The active mode is exposed as `document.documentElement.dataset.dshVisualizationAdapter` for local diagnostics.

## Supported content

| Fence | Behavior |
|---|---|
| `mermaid` | Mermaid diagrams with a beautiful-mermaid-inspired two-color system, `neo` layout, DSH light/dark tokens, rounded surfaces, fine borders, and soft shadows. |
| `kanban`, `quadrantChart`, `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`, `requirementDiagram` | Direct Mermaid subtype fences. The body may omit the diagram header; the renderer adds it privately while preserving the original source for copy/display. |
| `text` | Compatibility routing only: a block is treated as Mermaid when its first non-empty line is a supported Mermaid header. Ordinary text blocks keep the native code fallback. |
| `csv`, `tsv`, `json-table` | Filterable, sortable, paginated native table. |
| `vega-lite` | Static inline-only Vega-Lite v6 chart in a one-shot Worker. |
| `dsh-svg` | A model-authored complete static SVG document, validated against an independent allowlist and shown as a Blob `<img>`; see "Static dsh-svg channel" below. |

Mermaid also supports flowchart/graph, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, mindmap, timeline, gitGraph, and journey. `xychart-beta` and `sankey-beta` are intentionally not enabled. Ordinary `html`, `svg`, and `xml` code blocks are never taken over by this plugin and stay as source.

Complex diagrams can be opened in an expanded preview at their authored SVG size. The expanded view supports 10%–300% zoom, fit-to-window, scrollbars, mouse/touch drag-to-pan, keyboard zoom (`+`, `-`, `0`), and `Escape` or backdrop dismissal.

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

## Static dsh-svg channel

`dsh-svg` is for polished, presentation-grade hand-authored diagrams: the model emits one complete static SVG document instead of going through Mermaid or Vega-Lite. Routing:

- Ordinary flow, sequence, and relationship diagrams → Mermaid (default).
- Numeric charts and trend comparisons → `vega-lite`.
- Detail data → tables.
- Only when the user explicitly asks for a refined/presentation-grade diagram ("精排图", "用于展示", "按 diagram-design 绘制") or the `dsh-diagram-design` skill is loaded → `dsh-svg`.

Minimal example:

````markdown
```dsh-svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" role="img" aria-labelledby="demo-title demo-desc">
  <title id="demo-title">Architecture overview</title>
  <desc id="demo-desc">A client calls the orders service through a gateway; the service reads a database.</desc>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#4f5d75"/>
    </marker>
  </defs>
  <rect width="960" height="600" fill="#f5f5f5"/>
  <rect x="80" y="120" width="160" height="48" rx="6" fill="#ffffff" stroke="#2d3142"/>
  <text x="160" y="148" text-anchor="middle" font-size="12" fill="#2d3142"
        font-family="-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif">Client</text>
  <rect x="480" y="120" width="160" height="48" rx="6" fill="#ffffff" stroke="#2d3142"/>
  <text x="560" y="148" text-anchor="middle" font-size="12" fill="#2d3142"
        font-family="-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif">Orders</text>
  <path d="M 240 144 H 472" fill="none" stroke="#4f5d75" marker-end="url(#arrow)"/>
</svg>
```
````

Protocol highlights (the renderer validates every rule; invalid documents fail the preview and keep the full source visible):

- Exactly one SVG root; a positive finite `viewBox` is required; `<title>` must be the first child and `<title>`/`<desc>` must be non-empty.
- Element allowlist: `g`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`, `text`, `tspan`, `title`, `desc`, `defs`, `marker`.
- Presentation attributes only; `<style>`/`style`/`class`, scripts, event attributes, `foreignObject`, `image`/`use`/links, animation, filters, and any external or `data:`/`blob:` reference are rejected.
- `url(#id)` is allowed only on `marker-start/mid/end` and must target a `<marker>` in the document; ids must be unique and `aria-labelledby` IDREFs must resolve (sanitization prefixes every id and rewrites all references so relationships stay valid).
- Resource limits: source ≤ 128 KiB, ≤ 20,000 elements, ≤ 32 nesting levels, ≤ 8 KiB per attribute value, ≤ 4 KiB per text node, viewBox components ≤ 20,000.
- Background and colors are authored into the SVG (fixed light paper); the preview frame follows the DSH theme, theme switches never trigger a redraw, and no font/image network requests are made.

Copy keeps the original source; download saves the validated SVG.

## dsh-diagram-design skill

The package ships an on-demand `dsh-diagram-design` skill — a DSH adaptation of [diagram-design](https://github.com/cathrynlavery/diagram-design) pinned at commit `562dbdf`:

- Distributed as a packaged provider through the host skill registry (`ctx.skills`). It is never written into user skill directories, never outranks a user's own skill of the same name, and disappears when the plugin is uninstalled.
- Discovery and loading do not depend on any model call; host compositions without the `skills` service skip the skill entry while the visualization plugin keeps loading.
- The adapted skill always outputs `dsh-svg` (static, system fonts with CJK fallbacks, fixed light palette); the upstream HTML/remote-font/animation rules are superseded by the adaptation layer. Upstream reference files ship verbatim at the pinned commit under `skill/dsh-diagram-design/references/`; origin and local deltas are documented in `PROVENANCE.md`, and the upstream MIT license copy is in `LICENSE`.
- Triggering: ask "use dsh-diagram-design to draw …" or "draw a polished, presentation-grade architecture diagram" — the model loads the skill from the session catalog and emits `dsh-svg`. `/dsh-diagram-design` also invokes it directly.

## Security

- Rich rendering starts only after an assistant message settles; streaming stays plain code. The legacy adapter never deletes Host DOM and restores the original block on unload.
- Mermaid rejects directives, active links/callbacks, arbitrary HTML labels, remote resources, and unsafe CSS. Legacy `<br/>` label breaks are converted to inert separator text only in the private render input; copied source is unchanged. C4 embedded image icons are stripped; text and shapes remain.
- SVG is sanitized, structurally checked, locally ID-prefixed, serialized into a Blob, and shown through `<img>`; no raw SVG enters the document. `dsh-svg` uses its own independent policy (input constraints → structural validation → DOM allowlist rewriting → output re-validation) and does not inherit Mermaid's style/filter rules.
- Vega-Lite runs in a disposable Worker with AST interpretation, a deny-all loader, bounded input/output, and a two-second termination deadline. The `$schema` field is accepted only as the official v6 schema URL; it is metadata and is never fetched.
- No network fonts, external data, image loads, or raw HTML are enabled.

## Artifact size

The checked-in browser artifact intentionally contains the Mermaid/DOMPurify/css-tree/table implementation (~7.4 MB uncompressed). The optional Vega worker is a separate self-contained artifact (~1.7 MB). Neither is present until this optional package is installed.

## Development

```bash
npm test
npm run check
npm pack --dry-run
```

The `lib/` directory is committed on purpose: GitHub/pnpm installs consume prebuilt artifacts and do not build the plugin during profile installation. `lib/` is the release authority; `src/` is the source of truth. After changing source, run `npm run build` (rolldown + lightningcss, see `scripts/build.mjs`) to regenerate every `lib/` artifact, and review the resulting diff before tagging. The package exposes no TypeScript integration API: its supported integration is the DSH bundle metadata plus its capability-selected native/legacy browser adapters and the packaged skill registry entry.

## License

MIT. Derived DSH source retains the upstream DeepSeek copyright notice. Upstream reference material and the license copy under `skill/dsh-diagram-design/` come from cathrynlavery/diagram-design (MIT, Copyright (c) 2025 Cathryn Lavery).
