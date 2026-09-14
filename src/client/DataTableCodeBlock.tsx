import { useMemo } from 'react'
import type { AssistantCodeBlockViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { DataTable } from '../DataTable.tsx'
import type { DATA_TABLE_NS } from './locales.ts'
import { parseTableOutcome } from './parse.ts'

/** Props composed for one CSV, TSV, or JSON-table Assistant fence. */
export type DataTableCodeBlockProps = AssistantCodeBlockViewProps & PropsLocale<typeof DATA_TABLE_NS>

/**
 * Parse and render one settled table fence with localized table controls.
 * @param props - fence language, source, and locale seat.
 * @returns the shared table presentation, or the parse failure with its technical reason.
 */
export function DataTableCodeBlock({ language, source, t }: DataTableCodeBlockProps) {
  const outcome = useMemo(() => parseTableOutcome(language, source), [language, source])
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
  const errorDetail = outcome.ok ? undefined : t('error.cause', { detail: outcome.failure.detail })

  return <DataTable
    columns={outcome.ok ? outcome.table.columns : []}
    rows={outcome.ok ? outcome.table.rows : []}
    labels={labels}
    error={outcome.ok ? undefined : labels.error}
    errorDetail={errorDetail}
    pageSize={50}
  />
}
