import type {
  HostObservable, InjectFace, PropsLocale,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { AssistantCodeBlockViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { VegaLiteVisualization } from '../VegaLiteVisualization.tsx'
import type { VisualizationTheme } from '../types.ts'
import { visualizationLabels } from './locales.ts'
import type { VEGA_LITE_NS } from './locales.ts'

interface VegaLiteInjected {
  hooks: {
    theme: HostObservable<VisualizationTheme>
  }
}

type VegaLiteCodeBlockProps = AssistantCodeBlockViewProps
  & InjectFace<VegaLiteInjected>
  & PropsLocale<typeof VEGA_LITE_NS>

/** Render one settled `vega-lite` Assistant fence. */
export function VegaLiteCodeBlock({ source, useTheme, t }: VegaLiteCodeBlockProps) {
  const theme: VisualizationTheme = useTheme(value => value)
  const labels = visualizationLabels(t)
  return (
    <VegaLiteVisualization
      spec={parseSpec(source)}
      settled={true}
      labels={labels}
      theme={theme}
    />
  )
}

function parseSpec(source: string): unknown {
  try {
    return JSON.parse(source) as unknown
  } catch {
    return source
  }
}
