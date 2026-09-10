import { useMemo, useState } from 'react'
import { VisualizationFrame } from './VisualizationFrame.tsx'
import type { StaticSvgVisualizationProps } from './types.ts'

/**
 * Render one settled, authored static `dsh-svg` document through the shared
 * preview frame. The frame owns sanitization as its single boundary; this
 * component only supplies the raw source, the accessible-name fallbacks, and
 * the retry identity that rematerializes the frame's sanitization pass. The
 * accessible name is refined from the validated document inside the frame, so
 * no component ever parses raw source before the policy's size limit.
 * @param props - trusted plain source, labels, and theme identity.
 * @returns a secure image preview with source fallback.
 */
export function StaticSvgVisualization(props: StaticSvgVisualizationProps) {
  const [retry, setRetry] = useState(0)
  const settled = props.settled !== false
  const preview = useMemo(() => {
    if (!settled) return undefined
    return {
      svg: props.source,
      renderer: 'static-svg' as const,
      alt: props.alt ?? props.title ?? 'Static SVG diagram',
    }
    // retry produces a fresh preview identity so the frame re-validates.
  }, [settled, props.source, props.alt, props.title, retry])

  return (
    <VisualizationFrame
      source={props.source}
      language="xml"
      title={props.title}
      labels={props.labels}
      preview={preview}
      pending={settled ? undefined : true}
      onRetry={() => { setRetry(value => value + 1) }}
    />
  )
}