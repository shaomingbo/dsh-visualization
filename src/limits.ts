/** Fixed security and resource limits for visualization input and output. */
export const LIMITS = Object.freeze({
  sourceBytes: 64 * 1024,
  mermaidLines: 500,
  mermaidStatements: 500,
  mermaidEdges: 500,
  jsonDepth: 32,
  jsonNodes: 20_000,
  dataRows: 5_000,
  dataCells: 50_000,
  stringBytes: 8 * 1024,
  views: 32,
  transforms: 32,
  estimatedMarks: 20_000,
  dimension: 1_000,
  area: 1_000_000,
  compiledBytes: 1024 * 1024,
  compiledMarks: 256,
  compiledData: 128,
  compiledSignals: 256,
  compiledTransforms: 1_024,
  svgBytes: 2 * 1024 * 1024,
  svgElements: 20_000,
  svgAttributes: 64,
  queuePending: 4,
  workerTimeoutMs: 2_000,
} as const)

const encoder = new TextEncoder()

/**
 * Measure a string's UTF-8 size.
 * @param value - the string to measure.
 * @returns the encoded byte count.
 */
export function utf8Bytes(value: string): number {
  return encoder.encode(value).byteLength
}

/**
 * Throw when text exceeds a fixed UTF-8 byte limit.
 * @param value - the string to measure.
 * @param limit - the maximum encoded byte count.
 * @param subject - the value name used in the error message.
 */
export function assertByteLimit(value: string, limit: number, subject: string): void {
  if (utf8Bytes(value) > limit) throw new Error(`${subject} exceeds ${limit} UTF-8 bytes`)
}
