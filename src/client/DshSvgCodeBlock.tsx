import { useMemo } from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { AssistantCodeBlockViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { StaticSvgVisualization } from '../StaticSvgVisualization.tsx'
import { isStaticSvgFence } from '../svg-static-policy.ts'
import type {
  VisualizationLabels,
  VisualizationTheme,
} from '../types.ts'
import type { STATIC_SVG_NS } from './locales.ts'

/** Registration-owned reactive theme source. */
export interface DshSvgCodeBlockInjected {
  hooks: {
    /** Resolved light/dark identity bound by the slot renderer. */
    theme: ObservableSnapshot<VisualizationTheme>
  }
}

/** Props composed for one static `dsh-svg` assistant fence. */
export type DshSvgCodeBlockProps = AssistantCodeBlockViewProps
  & PropsLocale<typeof STATIC_SVG_NS>
  & InjectFace<DshSvgCodeBlockInjected>

/**
 * Render one settled static `dsh-svg` assistant fence with localized visualization controls.
 * @param props - fence source, framework-bound theme hook, and locale seat.
 * @returns the secure static SVG visualization surface.
 */
export function DshSvgCodeBlock({ language, source, codeLabels, useTheme, t }: DshSvgCodeBlockProps) {
  const theme = useTheme(value => value)
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
  if (!isStaticSvgFence(language)) {
    return (
      <CodeBlock
        code={`${source}\n`}
        lang={language}
        copyLabel={codeLabels?.copyLabel}
        copiedLabel={codeLabels?.copiedLabel}
      />
    )
  }
  return <StaticSvgVisualization source={source} settled labels={labels} theme={theme} />
}
