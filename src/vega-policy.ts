import { LIMITS, assertByteLimit, utf8Bytes } from './limits.ts'

const OBJECT = Object.prototype
const VIEW_KEYS = new Set(['layer', 'concat', 'hconcat', 'vconcat'])
const SOURCE_FORBIDDEN_KEYS = new Set([
  'url', 'href', 'src', 'image', 'on', 'bind', 'selection', 'select', 'params', 'usermeta', 'autosize', 'datasets',
  '__proto__', 'prototype', 'constructor',
])
const ALLOWED_SCHEMA = 'https://vega.github.io/schema/vega-lite/v6.json'
const ALLOWED_MARKS = new Set([
  'arc', 'area', 'bar', 'boxplot', 'circle', 'errorband', 'errorbar', 'geoshape',
  'line', 'point', 'rect', 'rule', 'square', 'text', 'tick', 'trail',
])
const EXPRESSION_KEYS = new Set(['expr', 'expression', 'calculate', 'test'])
const ALLOWED_TRANSFORMS = new Set([
  'aggregate', 'bin', 'joinaggregate', 'sample', 'stack', 'timeunit', 'window',
])

/**
 * Validate and clone a Vega-Lite request as JSON-compatible inline-only data.
 * @param input - the raw decoded specification.
 * @returns a detached JSON clone that passed all input policy checks.
 */
export function validateVegaLiteSpec(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) throw new Error('Vega-Lite spec must be a plain object')
  const source = JSON.stringify(input)
  assertByteLimit(source, LIMITS.sourceBytes, 'Vega-Lite spec')
  const state = { nodes: 0, views: 0, transforms: 0, rows: 0, cells: 0 }
  visitSource(input, 0, state, undefined)
  if (state.views > LIMITS.views) throw new Error(`Vega-Lite spec exceeds ${LIMITS.views} views`)
  if (state.transforms > LIMITS.transforms) throw new Error(`Vega-Lite spec exceeds ${LIMITS.transforms} transforms`)
  const estimatedMarks = Math.max(1, state.views) * Math.max(1, state.rows)
  if (estimatedMarks > LIMITS.estimatedMarks) {
    throw new Error(`Vega-Lite spec exceeds ${LIMITS.estimatedMarks} estimated marks`)
  }
  return JSON.parse(source) as Record<string, unknown>
}

/**
 * Validate compiled Vega runtime JSON before `vega.parse`.
 * @param input - the compiled Vega specification to audit.
 * @returns after the input passes all compiled-output policy checks.
 */
export function validateCompiledVega(input: unknown): asserts input is Record<string, unknown> {
  if (!isRecord(input)) throw new Error('Compiled Vega must be a plain object')
  const source = JSON.stringify(input)
  assertByteLimit(source, LIMITS.compiledBytes, 'Compiled Vega')
  assertArrayLimit(input.marks, LIMITS.compiledMarks, 'marks')
  assertArrayLimit(input.data, LIMITS.compiledData, 'data')
  assertArrayLimit(input.signals, LIMITS.compiledSignals, 'signals')
  let marks = 0
  let data = 0
  let signals = 0
  let transforms = 0
  walkJson(input, 0, (key, value) => {
    if (key === 'url' || key === 'href') throw new Error(`Compiled Vega ${key} is not allowed`)
    if (key === 'on' || key === 'bind') throw new Error(`Compiled Vega interaction ${key} is not allowed`)
    if (key === 'marks' && Array.isArray(value)) marks += value.length
    if (key === 'data' && Array.isArray(value)) data += value.length
    if (key === 'signals' && Array.isArray(value)) signals += value.length
    if (key === 'transform' && Array.isArray(value)) transforms += value.length
  })
  if (marks > LIMITS.compiledMarks) throw new Error(`Compiled Vega marks exceeds ${LIMITS.compiledMarks}`)
  if (data > LIMITS.compiledData) throw new Error(`Compiled Vega data exceeds ${LIMITS.compiledData}`)
  if (signals > LIMITS.compiledSignals) throw new Error(`Compiled Vega signals exceeds ${LIMITS.compiledSignals}`)
  if (transforms > LIMITS.compiledTransforms) {
    throw new Error(`Compiled Vega exceeds ${LIMITS.compiledTransforms} transforms`)
  }
}

function visitSource(
  value: unknown,
  depth: number,
  state: { nodes: number; views: number; transforms: number; rows: number; cells: number },
  parentKey: string | undefined,
): void {
  if (depth > LIMITS.jsonDepth) throw new Error(`Vega-Lite spec exceeds depth ${LIMITS.jsonDepth}`)
  state.nodes += 1
  if (state.nodes > LIMITS.jsonNodes) throw new Error(`Vega-Lite spec exceeds ${LIMITS.jsonNodes} JSON nodes`)
  if (typeof value === 'string') {
    if (utf8Bytes(value) > LIMITS.stringBytes) throw new Error(`Vega-Lite string exceeds ${LIMITS.stringBytes} UTF-8 bytes`)
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
      throw new Error('Vega-Lite strings must contain paired UTF-16 surrogates')
    }
    if (parentKey === '$schema') {
      if (value !== ALLOWED_SCHEMA) throw new Error('Vega-Lite $schema must be the official v6 schema URL')
      return
    }
    if (/(?:https?:|file:|data:|blob:|\/\/)/i.test(value)) throw new Error('Vega-Lite external URLs are not allowed')
    if (parentKey === 'mark' && !ALLOWED_MARKS.has(value.toLowerCase())) throw new Error(`Vega-Lite mark ${value} is not allowed`)
    return
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Vega-Lite numbers must be finite')
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return
  if (Array.isArray(value)) {
    if (parentKey === 'values') {
      state.rows += value.length
      if (state.rows > LIMITS.dataRows) throw new Error(`Vega-Lite data exceeds ${LIMITS.dataRows} rows`)
      for (const row of value) {
        if (!isRecord(row)) throw new Error('Vega-Lite rows must be plain objects')
        state.cells += Object.keys(row).length
        if (state.cells > LIMITS.dataCells) throw new Error(`Vega-Lite data exceeds ${LIMITS.dataCells} cells`)
        for (const cell of Object.values(row)) {
          if (!isScalar(cell)) throw new Error('Vega-Lite cells must be scalar JSON values')
        }
      }
    }
    for (const item of value) visitSource(item, depth + 1, state, parentKey)
    return
  }
  if (!isRecord(value)) throw new Error('Vega-Lite spec contains a non-JSON value')
  validateDimensions(value)
  if (parentKey === 'data' && Object.keys(value).some(key => key !== 'values')) {
    throw new Error('Vega-Lite data must contain only inline values')
  }
  if ('mark' in value || VIEW_KEYS.has(parentKey ?? '')) state.views += 1
  if (isRecord(value.mark)) {
    if (typeof value.mark.type !== 'string' || !ALLOWED_MARKS.has(value.mark.type.toLowerCase())) {
      throw new Error('Vega-Lite mark type is not allowed')
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (utf8Bytes(key) > LIMITS.stringBytes) throw new Error(`Vega-Lite key exceeds ${LIMITS.stringBytes} UTF-8 bytes`)
    const lowered = key.toLowerCase()
    if (SOURCE_FORBIDDEN_KEYS.has(lowered) || EXPRESSION_KEYS.has(lowered)) {
      throw new Error(`Vega-Lite property ${key} is not allowed`)
    }
    if (key === 'filter' && typeof child === 'string') throw new Error('Vega-Lite expression filters are not allowed')
    if (key === 'transform') {
      if (!Array.isArray(child)) throw new Error('Vega-Lite transform must be an array')
      state.transforms += child.length
      for (const transform of child) validateTransform(transform)
    }
    visitSource(child, depth + 1, state, key)
  }
}

function validateTransform(value: unknown): void {
  if (!isRecord(value)) throw new Error('Vega-Lite transform must be a plain object')
  const kinds = Object.keys(value).filter(key => ALLOWED_TRANSFORMS.has(key))
  if (kinds.length !== 1) throw new Error('Vega-Lite transform type is not allowed')
  if ('from' in value && isRecord(value.from) && 'data' in value.from) {
    throw new Error('Vega-Lite lookup from named or remote data is not allowed')
  }
}

function validateDimensions(spec: Record<string, unknown>): void {
  const width = readDimension(spec.width, 'width')
  const height = readDimension(spec.height, 'height')
  if (width !== undefined && height !== undefined && width * height > LIMITS.area) {
    throw new Error(`Vega-Lite dimensions exceed area ${LIMITS.area}`)
  }
}

function readDimension(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > LIMITS.dimension) {
    throw new Error(`Vega-Lite ${name} must be between 0 and ${LIMITS.dimension}`)
  }
  return value
}

function assertArrayLimit(value: unknown, limit: number, subject: string): void {
  if (value !== undefined && (!Array.isArray(value) || value.length > limit)) {
    throw new Error(`Compiled Vega ${subject} exceeds ${limit}`)
  }
}

function walkJson(value: unknown, depth: number, visit: (key: string, value: unknown) => void): void {
  if (depth > LIMITS.jsonDepth) throw new Error(`Compiled Vega exceeds depth ${LIMITS.jsonDepth}`)
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, depth + 1, visit)
    return
  }
  if (!isRecord(value)) return
  for (const [key, child] of Object.entries(value)) {
    visit(key, child)
    walkJson(child, depth + 1, visit)
  }
}

function isScalar(value: unknown): value is null | boolean | number | string {
  return value === null || typeof value === 'boolean' || typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === OBJECT || prototype === null
}
