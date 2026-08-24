import { useMemo } from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { AssistantCodeBlockViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { MermaidVisualization } from '../MermaidVisualization.tsx'
import { isMermaidFence, resolveMermaidFenceHeader } from '../mermaid-policy.ts'
import type {
  VisualizationLabels,
  VisualizationTheme,
} from '../types.ts'
import type { MERMAID_NS } from './locales.ts'

/** Registration-owned reactive theme source. */
export interface MermaidCodeBlockInjected {
  hooks: {
    /** Resolved light/dark identity bound by the slot renderer. */
    theme: ObservableSnapshot<VisualizationTheme>
  }
}

/** Props composed for one Mermaid assistant fence. */
export type MermaidCodeBlockProps = AssistantCodeBlockViewProps
  & PropsLocale<typeof MERMAID_NS>
  & InjectFace<MermaidCodeBlockInjected>

/**
 * Render one settled Mermaid assistant fence with localized visualization controls.
 * @param props - fence source, framework-bound theme hook, and locale seat.
 * @returns the secure Mermaid visualization surface.
 */
export function MermaidCodeBlock({ language, source, codeLabels, useTheme, t }: MermaidCodeBlockProps) {
  const theme = useTheme(value => value)
  const diagramHeader = resolveMermaidFenceHeader(language)
  const labels = useMemo<VisualizationLabels>(() => ({
    preview: t('preview'),
    source: t('source'),
    copy: t('copy'),
    copied: t('copied'),
    retry: t('retry'),
    download: t('download'),
    expand: t('expand'),
    expandedView: t('expandedView'),
    close: t('close'),
    zoomIn: t('zoomIn'),
    zoomOut: t('zoomOut'),
    resetZoom: t('resetZoom'),
    fit: t('fit'),
    dragToPan: t('dragToPan'),
    rendering: t('rendering'),
    unavailable: t('unavailable'),
    tooBusy: t('tooBusy'),
  }), [t])
  if (!isMermaidFence(language, source)) {
    return (
      <CodeBlock
        code={`${source}\n`}
        lang={language}
        copyLabel={codeLabels?.copyLabel}
        copiedLabel={codeLabels?.copiedLabel}
      />
    )
  }
  return <MermaidVisualization source={source} diagramHeader={diagramHeader} settled labels={labels} theme={theme} />
}
