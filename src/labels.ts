import type { VisualizationLabels } from './types.ts'

/** Default Chinese labels for visualization controls and status messages. */
export const DEFAULT_LABELS: VisualizationLabels = Object.freeze({
  preview: '预览',
  source: '源代码',
  copy: '复制',
  copied: '复制成功',
  retry: '重试',
  download: '下载 SVG',
  expand: '放大查看',
  expandedView: '可视化大图',
  close: '关闭',
  zoomIn: '放大',
  zoomOut: '缩小',
  resetZoom: '重置为 100%',
  fit: '适应窗口',
  dragToPan: '拖动查看局部',
  rendering: '正在渲染…',
  unavailable: '无法安全渲染此可视化',
  tooBusy: '渲染队列已满，请稍后重试',
})

/**
 * Merge caller-provided labels with the defaults.
 * @param overrides - labels that replace matching defaults.
 * @returns a complete label set.
 */
export function resolveLabels(overrides: Partial<VisualizationLabels> | undefined): VisualizationLabels {
  return { ...DEFAULT_LABELS, ...overrides }
}
