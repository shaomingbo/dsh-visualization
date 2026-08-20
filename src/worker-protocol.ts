/** Trusted palette colors and font read from DSH semantic tokens; never from model input. */
export interface VisualizationPalette {
  readonly foreground: string
  readonly muted: string
  readonly accent: string
  readonly border: string
  readonly background: string
  /** Raised surface tint for node fills (light/dark aware). */
  readonly surface: string
  /** Connector/edge color. */
  readonly line: string
  /** Font family for diagram text (system stack, never a network font). */
  readonly fontFamily: string
}

/** One render request crossing the worker serialization boundary. */
export interface VegaWorkerRequest {
  readonly kind: 'render'
  readonly id: string
  readonly spec: Record<string, unknown>
  readonly palette: VisualizationPalette
}

/** Discriminated response from the Vega-Lite worker. */
export type VegaWorkerResponse = VegaWorkerSuccess | VegaWorkerFailure

/** A successfully rendered SVG string. */
export interface VegaWorkerSuccess {
  readonly kind: 'success'
  readonly id: string
  readonly svg: string
}

/** A rendering failure with a stable error message. */
export interface VegaWorkerFailure {
  readonly kind: 'failure'
  readonly id: string
  readonly error: string
}

/**
 * Validate an inbound worker request discriminant, id, spec, and palette.
 * @param value - the decoded `postMessage` payload.
 * @returns true when the value is a well-formed render request.
 */
export function isVegaWorkerRequest(value: unknown): value is VegaWorkerRequest {
  if (!isRecord(value) || value.kind !== 'render' || typeof value.id !== 'string' || !isRecord(value.spec)) return false
  return isPalette(value.palette)
}

/**
 * Validate an inbound worker response discriminant and id match.
 * @param value - the decoded `postMessage` payload.
 * @param id - the request id this response must match.
 * @returns true when the value is a well-formed success or failure for the given id.
 */
export function isVegaWorkerResponse(value: unknown, id: string): value is VegaWorkerResponse {
  if (!isRecord(value) || value.id !== id) return false
  return (value.kind === 'success' && typeof value.svg === 'string' && Object.keys(value).length === 3)
    || (value.kind === 'failure' && typeof value.error === 'string' && Object.keys(value).length === 3)
}

function isPalette(value: unknown): value is VisualizationPalette {
  return isRecord(value)
    && Object.keys(value).length === 8
    && ['foreground', 'muted', 'accent', 'border', 'background', 'surface', 'line', 'fontFamily']
      .every(key => typeof value[key] === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
