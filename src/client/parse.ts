import { csvParseRows, tsvParseRows } from 'd3-dsv'

/** Parsed string-only table accepted by the shared DataTable presentation. */
export interface ParsedTable {
  readonly columns: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

/**
 * Parse one supported fence body into string columns and rows.
 * @param language - Normalized Markdown fence language.
 * @param source - Fence body.
 * @returns A parsed table, or `null` when a JSON-table body violates its input format.
 */
export function parseTable(language: string, source: string): ParsedTable | null {
  switch (language) {
    case 'csv':
      return parseDelimited(csvParseRows(source))
    case 'tsv':
      return parseDelimited(tsvParseRows(source))
    case 'json-table':
      return parseJsonTable(source)
    default:
      return null
  }
}

function parseDelimited(parsed: string[][]): ParsedTable {
  const [header = [], ...body] = parsed
  const counts = new Map<string, number>()
  for (const value of header) counts.set(value, (counts.get(value) ?? 0) + 1)
  const columns = header.map((value, index) => value !== '' && counts.get(value) === 1
    ? value
    : String(index + 1))
  const rows = body.map(row => columns.map((_, index) => row[index] ?? ''))
  return { columns, rows }
}

function parseJsonTable(source: string): ParsedTable | null {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    return null
  }
  if (!Array.isArray(value) || !value.every(isRecord)) return null

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringifyCell(value: unknown): string {
  return typeof value === 'object' && value !== null
    ? JSON.stringify(value)
    : String(value)
}
