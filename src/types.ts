/** Localized text used by visualization controls and status messages. */
export interface VisualizationLabels {
  readonly preview: string
  readonly source: string
  readonly copy: string
  readonly copied: string
  readonly retry: string
  readonly download: string
  readonly expand: string
  readonly expandedView: string
  readonly close: string
  readonly zoomIn: string
  readonly zoomOut: string
  readonly resetZoom: string
  readonly fit: string
  readonly dragToPan: string
  readonly rendering: string
  readonly unavailable: string
  readonly tooBusy: string
}

/** Plain theme identity that invalidates a palette read without exposing a theme service. */
export interface VisualizationTheme {
  readonly revision: number
  readonly colorScheme: 'light' | 'dark'
}

/** Renderer SVG supplied to {@link VisualizationFrame} for mandatory sanitization and Blob isolation. */
interface VisualizationPreview {
  readonly svg: string
  readonly renderer: 'mermaid' | 'vega-lite'
  readonly alt: string
}

/** Props for the shared preview/source visualization frame. */
export interface VisualizationFrameProps {
  readonly source: string
  readonly language: string
  readonly title?: string | undefined
  readonly preview?: VisualizationPreview | undefined
  readonly pending?: boolean | undefined
  /** Lazy deferral before any render attempt; shows progress, never the failure label. */
  readonly waiting?: boolean | undefined
  readonly preferSource?: boolean | undefined
  readonly error?: string | undefined
  readonly onRetry?: (() => void) | undefined
  readonly labels?: Partial<VisualizationLabels> | undefined
}

/** Props shared by secure Mermaid and Vega-Lite renderers. */
interface VisualizationProps {
  readonly settled: boolean
  readonly title?: string | undefined
  readonly alt?: string | undefined
  readonly labels?: Partial<VisualizationLabels> | undefined
  readonly theme: VisualizationTheme
}

/** Canonical Mermaid header injected for a direct subtype fence. */
export type MermaidDiagramHeader =
  | 'kanban'
  | 'quadrantChart'
  | 'C4Context'
  | 'C4Container'
  | 'C4Component'
  | 'C4Dynamic'
  | 'C4Deployment'
  | 'requirementDiagram'

/** Props for a Mermaid diagram. */
export interface MermaidVisualizationProps extends VisualizationProps {
  /** Original fence body retained for source display and copying. */
  readonly source: string
  /** Canonical header added only to the private render input when omitted. */
  readonly diagramHeader?: MermaidDiagramHeader | undefined
}

/** Props for an inline-only Vega-Lite visualization. */
export interface VegaLiteVisualizationProps extends VisualizationProps {
  readonly spec: unknown
}

/** Localized labels for the accessible data table. */
export interface DataTableLabels {
  readonly filterPlaceholder: string
  readonly empty: string
  readonly sortAscending: string
  readonly sortDescending: string
  readonly previousPage: string
  readonly nextPage: string
  readonly page: (page: number, pages: number) => string
  readonly error: string
}

/** Props for the shared accessible data table presentation. */
export interface DataTableProps {
  readonly columns: readonly string[]
  readonly rows: readonly (readonly string[])[]
  readonly labels: DataTableLabels
  readonly error?: string | undefined
  readonly pageSize?: number | undefined
}
