import { useEffect, useMemo, useState } from 'react'
import { CodeBlock, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import { resolveLabels } from './labels.ts'
import { useSvgUrl } from './render-lifecycle.ts'
import { sanitizeVisualizationSvg } from './svg-sanitizer.ts'
import type { VisualizationFrameProps } from './types.ts'
import css from './VisualizationFrame.module.css'

/**
 * Render shared visualization chrome while sanitizing SVG into an image-only Blob URL.
 * @param props - Plain source, renderer SVG, labels, status, and retry callback.
 * @returns the preview/source frame.
 */
export function VisualizationFrame(props: VisualizationFrameProps) {
  const labels = useMemo(() => resolveLabels(props.labels), [props.labels])
  const [tab, setTab] = useState<'preview' | 'source'>(props.preferSource === true ? 'source' : 'preview')
  const [copied, setCopied] = useState(false)
  const sanitized = useMemo(() => sanitizePreview(props.preview), [props.preview])
  const previewUrl = useSvgUrl(sanitized.svg)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => { setCopied(false) }, 1_000)
    return () => { window.clearTimeout(timer) }
  }, [copied])

  const copy = () => {
    void writeClipboard(props.source).then((accepted) => {
      if (accepted) setCopied(true)
    })
  }
  const showPreview = tab === 'preview'
  const error = props.error ?? sanitized.error
  return (
    <section className={css.frame} aria-label={props.title}>
      <header className={css.toolbar}>
        <div className={css.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={showPreview} onClick={() => { setTab('preview') }}>{labels.preview}</button>
          <button type="button" role="tab" aria-selected={!showPreview} onClick={() => { setTab('source') }}>{labels.source}</button>
        </div>
        <div className={css.actions}>
          <button type="button" onClick={copy}>{copied ? labels.copied : labels.copy}</button>
          {previewUrl !== undefined && (
            <a href={previewUrl} download={`${safeFilename(props.title)}.svg`}>{labels.download}</a>
          )}
        </div>
      </header>
      <div role="tabpanel" className={css.body}>
        {showPreview
          ? (
            <PreviewBody
              pending={props.pending}
              error={error}
              previewUrl={previewUrl}
              alt={props.preview?.alt}
              onRetry={props.onRetry}
              labels={labels}
            />
          )
          : <CodeBlock code={props.source} lang={props.language} copyLabel={labels.copy} copiedLabel={labels.copied} />}
      </div>
    </section>
  )
}

interface PreviewBodyProps {
  readonly pending: boolean | undefined
  readonly error: string | undefined
  readonly previewUrl: string | undefined
  readonly alt: string | undefined
  readonly onRetry: (() => void) | undefined
  readonly labels: ReturnType<typeof resolveLabels>
}

function PreviewBody(props: PreviewBodyProps) {
  if (props.pending === true) return <p className={css.status}>{props.labels.rendering}</p>
  if (props.error !== undefined) {
    return (
      <div className={css.status} role="alert">
        <p>{props.labels.unavailable}: {props.error}</p>
        {props.onRetry !== undefined && <button type="button" onClick={props.onRetry}>{props.labels.retry}</button>}
      </div>
    )
  }
  if (props.previewUrl === undefined) return <p className={css.status}>{props.labels.unavailable}</p>
  return <img className={css.preview} src={props.previewUrl} alt={props.alt ?? ''} />
}

function sanitizePreview(preview: VisualizationFrameProps['preview']): { readonly svg?: string; readonly error?: string } {
  if (preview === undefined) return {}
  try {
    return { svg: sanitizeVisualizationSvg(preview.svg, preview.renderer) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'SVG sanitization failed' }
  }
}

function safeFilename(title: string | undefined): string {
  const safe = (title ?? 'visualization').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '')
  return safe || 'visualization'
}
