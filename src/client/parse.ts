import { csvParseRows, tsvParseRows } from 'd3-dsv'
import { parseJsonTable, type ParsedTable } from './parse-json-table.ts'

export type { ParsedTable } from './parse-json-table.ts'

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
