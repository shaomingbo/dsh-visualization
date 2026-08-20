import type { VisualizationLabels } from '../types.ts'

/** Dictionaries for the visualization renderer namespaces. */

/** Mermaid dictionary namespace. */
export const MERMAID_NS = 'mermaid'

/** Simplified Chinese Mermaid dictionary. */
export const mermaidZh = {
  'preview': '预览',
  'source': '源代码',
  'copy': '复制',
  'copied': '复制成功',
  'retry': '重试',
  'download': '下载 SVG',
  'rendering': '正在渲染…',
  'unavailable': '无法安全渲染此 Mermaid 图表',
  'tooBusy': '渲染队列已满，请稍后重试',
}

/** Mermaid dictionary key union. */
export type MermaidKey = keyof typeof mermaidZh

/** English Mermaid dictionary. */
export const mermaidEn: Record<MermaidKey, string> = {
  'preview': 'Preview',
  'source': 'Source',
  'copy': 'Copy',
  'copied': 'Copied',
  'retry': 'Retry',
  'download': 'Download SVG',
  'rendering': 'Rendering…',
  'unavailable': 'Unable to render this Mermaid diagram safely',
  'tooBusy': 'The render queue is full; try again later',
}

/** Data-table dictionary namespace. */
export const DATA_TABLE_NS = 'dataTable'

/** Simplified Chinese data-table dictionary. */
export const dataTableZh = {
  'filter.placeholder': '筛选表格',
  'empty': '没有匹配的数据',
  'sort.ascending': '升序排列',
  'sort.descending': '降序排列',
  'pagination.previous': '上一页',
  'pagination.next': '下一页',
  'pagination.page': '第 {page} 页，共 {pages} 页',
  'error.invalid': '无法将此代码块解析为表格',
} satisfies Record<string, string>

/** Data-table dictionary key union. */
export type DataTableKey = keyof typeof dataTableZh

/** English data-table dictionary. */
export const dataTableEn = {
  'filter.placeholder': 'Filter table',
  'empty': 'No matching rows',
  'sort.ascending': 'Sort ascending',
  'sort.descending': 'Sort descending',
  'pagination.previous': 'Previous page',
  'pagination.next': 'Next page',
  'pagination.page': 'Page {page} of {pages}',
  'error.invalid': 'Unable to parse this code block as a table',
} satisfies Record<DataTableKey, string>

/** Vega-Lite dictionary namespace. */
export const VEGA_LITE_NS = 'vegaLite'

/** Simplified Chinese Vega-Lite dictionary. */
export const vegaLiteZh = {
  'preview': '预览',
  'source': '源代码',
  'copy': '复制',
  'copied': '复制成功',
  'retry': '重试',
  'download': '下载 SVG',
  'rendering': '正在渲染…',
  'unavailable': '无法安全渲染此可视化',
  'tooBusy': '渲染队列已满，请稍后重试',
}

/** Vega-Lite dictionary key union. */
export type VegaLiteKey = keyof typeof vegaLiteZh

/** English Vega-Lite dictionary. */
export const vegaLiteEn: Record<VegaLiteKey, string> = {
  'preview': 'Preview',
  'source': 'Source',
  'copy': 'Copy',
  'copied': 'Copied',
  'retry': 'Retry',
  'download': 'Download SVG',
  'rendering': 'Rendering…',
  'unavailable': 'This visualization cannot be rendered safely',
  'tooBusy': 'The rendering queue is full. Try again later.',
}

/**
 * Resolve the complete visualization label set through the active locale.
 * @param t - namespace-bound translator.
 * @returns labels accepted by the Cordis-free visualization component.
 */
export function visualizationLabels(t: (key: VegaLiteKey) => string): VisualizationLabels {
  return {
    preview: t('preview'),
    source: t('source'),
    copy: t('copy'),
    copied: t('copied'),
    retry: t('retry'),
    download: t('download'),
    rendering: t('rendering'),
    unavailable: t('unavailable'),
    tooBusy: t('tooBusy'),
  }
}
