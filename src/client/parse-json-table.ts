/** Parsed string-only table accepted by the shared DataTable presentation. */
export interface ParsedTable {
  readonly columns: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

/** Parse either an array of records or an explicit columns/rows JSON table. */
export function parseJsonTable(source: string): ParsedTable | null {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    return null
  }
  if (Array.isArray(value)) return parseRecordRows(value)
  if (isRecord(value)) return parseExplicitRows(value)
  return null
}

function parseRecordRows(value: unknown[]): ParsedTable | null {
  if (!value.every(isRecord)) return null
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

function parseExplicitRows(value: Record<string, unknown>): ParsedTable | null {
  const { columns, rows } = value
  if (!Array.isArray(columns) || !columns.every(column => typeof column === 'string')) return null
  if (!Array.isArray(rows) || !rows.every(Array.isArray)) return null
  return {
    columns,
    rows: rows.map(row => columns.map((_, index) => index < row.length
      ? stringifyCell(row[index])
      : '')),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringifyCell(value: unknown): string {
  return typeof value === 'object' && value !== null
    ? JSON.stringify(value)
    : String(value)
}
