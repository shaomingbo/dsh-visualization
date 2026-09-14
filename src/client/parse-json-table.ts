/** Parsed string-only table accepted by the shared DataTable presentation. */
export interface ParsedTable {
  readonly columns: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

/** Technical, non-localized reason one json-table body failed to parse. */
export interface JsonTableFailure {
  /** Which acceptance rule rejected the body. */
  readonly stage: 'json-syntax' | 'shape' | 'mixed-rows'
  /** Concrete reason, e.g. the JSON parser's own error message. */
  readonly detail: string
}

/** Either a parsed table, or a failure carrying its technical reason. */
export type JsonTableOutcome =
  | { readonly ok: true; readonly table: ParsedTable }
  | { readonly ok: false; readonly failure: JsonTableFailure }

/**
 * Parse one json-table body into an outcome that names the concrete failure.
 *
 * Three shapes are accepted:
 * 1. an array of flat records — columns are the union of keys in first-seen order;
 * 2. an explicit `{ columns, rows }` object;
 * 3. an array of row arrays whose first row is the header (the same convention as `csv`).
 *
 * Anything else — including brace-comma pseudo-objects like `{"A","B"}`, which are
 * not JSON — fails with a concrete reason (the JSON parser's own message for syntax
 * errors, a shape description otherwise) so the mistake is self-explanatory.
 * @param source - Fence body.
 * @returns A parsed table, or a failure with its technical reason.
 */
export function parseJsonTableOutcome(source: string): JsonTableOutcome {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (error) {
    return {
      ok: false,
      failure: {
        stage: 'json-syntax',
        detail: error instanceof Error ? error.message : String(error),
      },
    }
  }
  if (Array.isArray(value)) {
    if (value.every(isRecord)) return ok(parseRecordRows(value))
    if (value.every(Array.isArray)) return ok(parseMatrixRows(value))
    const hasRecords = value.some(isRecord)
    const hasArrays = value.some(Array.isArray)
    if (hasRecords && hasArrays) {
      return {
        ok: false,
        failure: {
          stage: 'mixed-rows',
          detail: 'array mixes object records and row arrays; use one shape per table',
        },
      }
    }
    const index = value.findIndex(item => !isRecord(item) && !Array.isArray(item))
    return {
      ok: false,
      failure: {
        stage: 'shape',
        detail: `array form requires flat objects, or row arrays whose first row is the header; found ${typeName(value[index])} at index ${index}`,
      },
    }
  }
  if (isRecord(value)) return parseExplicitRows(value)
  return {
    ok: false,
    failure: {
      stage: 'shape',
      detail: `top level must be an array or an object with "columns" and "rows", got ${typeName(value)}`,
    },
  }
}

/** Back-compat entry: the parsed table, or `null` when the body violates the format. */
export function parseJsonTable(source: string): ParsedTable | null {
  const outcome = parseJsonTableOutcome(source)
  return outcome.ok ? outcome.table : null
}

function ok(table: ParsedTable): JsonTableOutcome {
  return { ok: true, table }
}

function parseRecordRows(value: unknown[]): ParsedTable {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    for (const key of Object.keys(item)) {
      if (seen.has(key)) continue
      seen.add(key)
      columns.push(key)
    }
  }
  const rows = value.map(item => columns.map(column => column in item
    ? stringifyCell(item[column])
    : ''))
  return { columns, rows }
}

/** Parse a matrix whose first row is the header; ragged rows are padded or truncated. */
function parseMatrixRows(value: unknown[][]): ParsedTable {
  const [header = [], ...body] = value
  const columns = header.map(stringifyCell)
  const rows = body.map(row => columns.map((_, index) => index < row.length
    ? stringifyCell(row[index])
    : ''))
  return { columns, rows }
}

function parseExplicitRows(value: Record<string, unknown>): JsonTableOutcome {
  const { columns, rows } = value
  const malformed = !Array.isArray(columns) || !columns.every(isString)
    || !Array.isArray(rows) || !rows.every(Array.isArray)
  if (malformed) {
    return {
      ok: false,
      failure: {
        stage: 'shape',
        detail: 'object form requires "columns": string[] and "rows": unknown[][]',
      },
    }
  }
  return ok({
    columns,
    rows: rows.map(row => columns.map((_, index) => index < row.length
      ? stringifyCell(row[index])
      : '')),
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function typeName(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function stringifyCell(value: unknown): string {
  return typeof value === 'object' && value !== null
    ? JSON.stringify(value)
    : String(value)
}