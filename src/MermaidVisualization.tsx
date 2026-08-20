import { useEffect, useMemo, useState } from 'react'
import { VisualizationFrame } from './VisualizationFrame.tsx'
import { LIMITS } from './limits.ts'
import { prepareMermaidSource, validateMermaidSource } from './mermaid-policy.ts'
import { buildMermaidConfig } from './mermaid-theme.ts'
import { SerializedQueue, type QueueOperation } from './queue.ts'
import { useSettledVisibility, useVisualizationPalette } from './render-lifecycle.ts'
import type { MermaidVisualizationProps } from './types.ts'

const queue = new SerializedQueue(LIMITS.queuePending)
let diagramSequence = 0

/**
 * Lazily render one settled, visible Mermaid diagram through the serialized global runtime.
 * @param props - Trusted plain source, labels, and theme identity.
 * @returns a secure image preview with source fallback.
 */
export function MermaidVisualization(props: MermaidVisualizationProps) {
  /* jscpd:ignore-start */
  const [rootRef, visibility] = useSettledVisibility(props.settled)
  const palette = useVisualizationPalette(props.theme)
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<{ svg?: string; error?: string; pending: boolean }>({ pending: false })

  useEffect(() => {
    if (visibility !== 'visible' || !props.settled) return
    let operation: QueueOperation<string> | undefined
    let current = true
    try {
      const renderSource = prepareMermaidSource(props.source, props.diagramHeader)
      validateMermaidSource(renderSource)
      setState({ pending: true })
      operation = queue.enqueue(() => renderMermaid(renderSource, palette, props.theme.colorScheme))
      void operation.result.then(
        (svg) => { if (current) setState({ svg, pending: false }) },
        (error: unknown) => {
          if (current && !isAbortError(error)) setState({ error: errorMessage(error), pending: false })
        },
      )
    } catch (error) {
      setState({ error: errorMessage(error), pending: false })
    }
    return () => {
      current = false
      operation?.cancel()
    }
  }, [visibility, props.settled, props.source, props.diagramHeader, props.theme.colorScheme, palette, retry])

  const preview = useMemo(() => state.svg === undefined ? undefined : {
    svg: state.svg,
    renderer: 'mermaid' as const,
    alt: props.alt ?? props.title ?? 'Mermaid visualization',
  }, [state.svg, props.alt, props.title])
  return (
    <div ref={rootRef}>
      <VisualizationFrame
        source={props.source}
        language="mermaid"
        title={props.title}
        labels={props.labels}
        preview={preview}
        pending={state.pending}
        error={state.error}
        preferSource={visibility === 'unsupported'}
        onRetry={() => { setRetry(value => value + 1) }}
      />
    </div>
  )
  /* jscpd:ignore-end */
}

async function renderMermaid(
  source: string,
  palette: ReturnType<typeof useVisualizationPalette>,
  colorScheme: 'light' | 'dark',
): Promise<string> {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize(buildMermaidConfig(palette, colorScheme, source, LIMITS.mermaidEdges))
  const host = document.createElement('div')
  host.style.position = 'absolute'
  host.style.left = '-9999px'
  document.body.appendChild(host)
  try {
    const result = await mermaid.render(`dsh-mermaid-${++diagramSequence}`, source, host)
    return result.svg
  } finally {
    host.remove()
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Mermaid rendering failed'
}
