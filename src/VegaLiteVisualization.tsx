import { useEffect, useMemo, useState } from 'react'
import { VisualizationFrame } from './VisualizationFrame.tsx'
import { useSettledVisibility, useVisualizationPalette } from './render-lifecycle.ts'
import type { VegaLiteVisualizationProps } from './types.ts'
import { validateVegaLiteSpec } from './vega-policy.ts'
import { renderVegaInWorker } from './vega-worker-client.ts'

/**
 * Render a settled, visible inline-only Vega-Lite document in a one-shot worker.
 * @param props - Trusted plain specification, labels, and theme identity.
 * @returns a secure image preview with source fallback.
 */
export function VegaLiteVisualization(props: VegaLiteVisualizationProps) {
  /* jscpd:ignore-start */
  const [rootRef, visibility] = useSettledVisibility(props.settled)
  const palette = useVisualizationPalette(props.theme)
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<{ svg?: string; error?: string; pending: boolean }>({ pending: false })
  const source = useMemo(() => stringifySpec(props.spec), [props.spec])

  useEffect(() => {
    if (visibility !== 'visible' || !props.settled || source.error !== undefined) return
    let current = true
    try {
      const spec = validateVegaLiteSpec(props.spec)
      setState({ pending: true })
      const operation = renderVegaInWorker(spec, palette)
      void operation.result.then(
        (svg) => { if (current) setState({ svg, pending: false }) },
        (error: unknown) => {
          if (current && !isAbortError(error)) setState({ error: errorMessage(error), pending: false })
        },
      )
      return () => {
        current = false
        operation.cancel()
      }
    } catch (error) {
      setState({ error: errorMessage(error), pending: false })
    }
  }, [visibility, props.settled, props.spec, palette, retry, source.error])

  const preview = useMemo(() => state.svg === undefined ? undefined : {
    svg: state.svg,
    renderer: 'vega-lite' as const,
    alt: props.alt ?? props.title ?? 'Vega-Lite visualization',
  }, [state.svg, props.alt, props.title])
  const error = source.error ?? state.error
  return (
    <div ref={rootRef}>
      <VisualizationFrame
        source={source.value}
        language="json"
        title={props.title}
        labels={props.labels}
        preview={preview}
        pending={state.pending}
        waiting={visibility === 'waiting'}
        error={error}
        preferSource={visibility === 'unsupported'}
        onRetry={source.error === undefined ? () => { setRetry(value => value + 1) } : undefined}
      />
    </div>
  )
  /* jscpd:ignore-end */
}

function stringifySpec(spec: unknown): { readonly value: string; readonly error?: string } {
  try {
    const value = JSON.stringify(spec, null, 2)
    return typeof value === 'string' ? { value } : { value: '', error: 'Vega-Lite spec is not JSON data' }
  } catch (error) {
    return { value: '', error: errorMessage(error) }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Vega-Lite rendering failed'
}
