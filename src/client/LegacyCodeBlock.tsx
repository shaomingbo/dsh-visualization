import { useMemo, useSyncExternalStore } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { DataTable } from '../DataTable.tsx'
import { MermaidVisualization } from '../MermaidVisualization.tsx'
import { VegaLiteVisualization } from '../VegaLiteVisualization.tsx'
import { isMermaidFence, resolveMermaidFenceHeader } from '../mermaid-policy.ts'
import type { VisualizationTheme } from '../types.ts'
import { parseTable } from './parse.ts'
import type { DataTableKey, MermaidKey, VegaLiteKey } from './locales.ts'
import { visualizationLabels } from './locales.ts'

export type Translate<Key extends string> = (key: Key, params?: Record<string, unknown>) => string

export interface LegacyCodeBlockProps {
  readonly language: string
  readonly source: string
  readonly theme: ObservableSnapshot<VisualizationTheme>
  readonly tMermaid: Translate<MermaidKey>
  readonly tDataTable: Translate<DataTableKey>
  readonly tVegaLite: Translate<VegaLiteKey>
}

/** Render one legacy DOM claim through the same secure presentation modules as the native slot adapter. */
export function LegacyCodeBlock({
  language,
  source,
  theme,
  tMermaid,
  tDataTable,
  tVegaLite,
}: LegacyCodeBlockProps) {
  const activeTheme = useSyncExternalStore(theme.subscribe, theme.getSnapshot, theme.getSnapshot)
  if (isMermaidFence(language, source)) {
    return <MermaidVisualization
      source={source}
      diagramHeader={resolveMermaidFenceHeader(language)}
      settled
      labels={visualizationLabels(tMermaid as Translate<VegaLiteKey>)}
      theme={activeTheme}
    />
  }
  if (language === 'vega-lite') {
    return <VegaLiteVisualization
      spec={parseSpec(source)}
      settled
      labels={visualizationLabels(tVegaLite)}
      theme={activeTheme}
    />
  }
  return <LegacyDataTable language={language} source={source} t={tDataTable} />
}

function LegacyDataTable({
  language,
  source,
  t,
}: {
  readonly language: string
  readonly source: string
  readonly t: Translate<DataTableKey>
}) {
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

function parseSpec(source: string): unknown {
  try {
    return JSON.parse(source) as unknown
  } catch {
    return source
  }
}
