import { useMemo } from 'react'
import type { AssistantCodeBlockViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { DataTable } from '../DataTable.tsx'
import type { DATA_TABLE_NS } from './locales.ts'
import { parseTable } from './parse.ts'

/** Props composed for one CSV, TSV, or JSON-table Assistant fence. */
export type DataTableCodeBlockProps = AssistantCodeBlockViewProps & PropsLocale<typeof DATA_TABLE_NS>

/**
 * Parse and render one settled table fence with localized table controls.
 * @param props - fence language, source, and locale seat.
 * @returns the shared table presentation, or nothing for invalid JSON-table input.
 */
export function DataTableCodeBlock({ language, source, t }: DataTableCodeBlockProps) {
  const table = useMemo(() => parseTable(language, source), [language, source])
  const labels = useMemo(() => ({
    filterPlaceholder: t('filter.placeholder'),
    empty: t('empty'),
    sortAscending: t('sort.ascending'),
    sortDescending: t('sort.descending'),
    previousPage: t('pagination.previous'),
    nextPage: t('pagination.next'),
    page: (page: number, pages: number) => t('pagination.page', { page, pages }),
    error: t('error.invalid'),
  }), [t])

  return <DataTable
    columns={table?.columns ?? []}
    rows={table?.rows ?? []}
    labels={labels}
    error={table === null ? labels.error : undefined}
    pageSize={50}
  />
}
