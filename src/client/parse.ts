import { csvParseRows, tsvParseRows } from 'd3-dsv'
import { parseJsonTableOutcome, type JsonTableFailure, type ParsedTable } from './parse-json-table.ts'

export type { ParsedTable, JsonTableFailure } from './parse-json-table.ts'

/** One fence-body parse: a table, or a failure with its technical reason. */
export type TableParseOutcome =
  | { readonly ok: true; readonly table: ParsedTable }
  | { readonly ok: false; readonly failure: JsonTableFailure }

/**
 * Parse one supported fence body into string columns and rows.
 * @param language - Normalized Markdown fence language.
 * @param source - Fence body.
 * @returns The parsed table, or a failure naming the concrete reason.
 */
export function parseTableOutcome(language: string, source: string): TableParseOutcome {
  switch (language) {
    case 'csv':
      return { ok: true, table: parseDelimited(csvParseRows(source)) }
    case 'tsv':
      return { ok: true, table: parseDelimited(tsvParseRows(source)) }
    case 'json-table':
      return parseJsonTableOutcome(source)
    default:
      return {
        ok: false,
        failure: {
          stage: 'shape',
          detail: `unsupported table fence language: ${language}`,
        },
      }
  }
}

/**
 * Parse one supported fence body into string columns and rows.
 * @param language - Normalized Markdown fence language.
 * @param source - Fence body.
 * @returns A parsed table, or `null` when a JSON-table body violates its input format.
 */
export function parseTable(language: string, source: string): ParsedTable | null {
  const outcome = parseTableOutcome(language, source)
  return outcome.ok ? outcome.table : null
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