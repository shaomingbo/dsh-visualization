import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { CodeBlock, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import { resolveLabels } from './labels.ts'
import { useSvgUrl } from './render-lifecycle.ts'
import { sanitizeVisualizationSvg } from './svg-sanitizer.ts'
import type { VisualizationFrameProps } from './types.ts'
import css from './VisualizationFrame.module.css'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25
const PAN_THRESHOLD = 4

/**
 * Render shared visualization chrome while sanitizing SVG into an image-only Blob URL.
 * @param props - Plain source, renderer SVG, labels, status, and retry callback.
 * @returns the preview/source frame.
 */
export function VisualizationFrame(props: VisualizationFrameProps) {
  const labels = useMemo(() => resolveLabels(props.labels), [props.labels])
  const [tab, setTab] = useState<'preview' | 'source'>(props.preferSource === true ? 'source' : 'preview')
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const sanitized = useMemo(() => sanitizePreview(props.preview), [props.preview])
  const previewUrl = useSvgUrl(sanitized.svg)
  const openExpanded = useCallback(() => { setExpanded(true) }, [])
  const closeExpanded = useCallback(() => { setExpanded(false) }, [])

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
          {showPreview && previewUrl !== undefined && (
            <button type="button" onClick={openExpanded}>{labels.expand}</button>
          )}
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
              onExpand={openExpanded}
              labels={labels}
            />
          )
          : <CodeBlock code={props.source} lang={props.language} copyLabel={labels.copy} copiedLabel={labels.copied} />}
      </div>
      {expanded && previewUrl !== undefined && createPortal(
        <PreviewLightbox
          previewUrl={previewUrl}
          alt={props.preview?.alt}
          title={props.title}
          dimensions={sanitized.dimensions}
          labels={labels}
          onClose={closeExpanded}
        />,
        document.body,
      )}
    </section>
  )
}

interface PreviewBodyProps {
  readonly pending: boolean | undefined
  readonly error: string | undefined
  readonly previewUrl: string | undefined
  readonly alt: string | undefined
  readonly onRetry: (() => void) | undefined
  readonly onExpand: () => void
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
  const accessibleName = props.alt === undefined ? props.labels.expand : `${props.labels.expand}: ${props.alt}`
  return (
    <button type="button" className={css.previewTrigger} onClick={props.onExpand} aria-label={accessibleName} title={props.labels.expand}>
      <img className={css.preview} src={props.previewUrl} alt="" />
      <span className={css.expandHint} aria-hidden="true">↗ {props.labels.expand}</span>
    </button>
  )
}

interface SvgDimensions {
  readonly width: number
  readonly height: number
}

interface PanGesture {
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
  readonly scrollLeft: number
  readonly scrollTop: number
  readonly startedOnStage: boolean
  moved: boolean
}

interface PreviewLightboxProps {
  readonly previewUrl: string
  readonly alt: string | undefined
  readonly title: string | undefined
  readonly dimensions: SvgDimensions | undefined
  readonly labels: ReturnType<typeof resolveLabels>
  readonly onClose: () => void
}

function PreviewLightbox(props: PreviewLightboxProps) {
  const [zoom, setZoom] = useState(1)
  const [panning, setPanning] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panGestureRef = useRef<PanGesture | undefined>(undefined)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        props.onClose()
        return
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setZoom(value => clampZoom(value + ZOOM_STEP))
        return
      }
      if (event.key === '-') {
        event.preventDefault()
        setZoom(value => clampZoom(value - ZOOM_STEP))
        return
      }
      if (event.key === '0') {
        event.preventDefault()
        setZoom(1)
        return
      }
      if (event.key !== 'Tab') return
      const controls = overlayRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
      if (controls === undefined || controls.length === 0) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [props.onClose])

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.pointerType === 'mouse' || event.pointerType === 'pen') && event.button !== 0) return
    const canvas = canvasRef.current
    if (canvas === null || panGestureRef.current !== undefined) return
    panGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
      startedOnStage: event.target === stageRef.current,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPanning(true)
    event.preventDefault()
  }
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = panGestureRef.current
    const canvas = canvasRef.current
    if (gesture === undefined || gesture.pointerId !== event.pointerId || canvas === null) return
    const deltaX = event.clientX - gesture.startX
    const deltaY = event.clientY - gesture.startY
    if (!gesture.moved && Math.hypot(deltaX, deltaY) < PAN_THRESHOLD) return
    gesture.moved = true
    canvas.scrollLeft = gesture.scrollLeft - deltaX
    canvas.scrollTop = gesture.scrollTop - deltaY
    event.preventDefault()
  }
  const finishPan = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const gesture = panGestureRef.current
    if (gesture === undefined || gesture.pointerId !== event.pointerId) return
    panGestureRef.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setPanning(false)
    if (!cancelled && !gesture.moved && gesture.startedOnStage) props.onClose()
  }
  const losePanCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panGestureRef.current?.pointerId !== event.pointerId) return
    panGestureRef.current = undefined
    setPanning(false)
  }

  const fitToWindow = () => {
    const canvas = canvasRef.current
    if (canvas === null || props.dimensions === undefined) {
      setZoom(1)
      return
    }
    const horizontalPadding = 64
    const verticalPadding = 64
    const widthScale = (canvas.clientWidth - horizontalPadding) / props.dimensions.width
    const heightScale = (canvas.clientHeight - verticalPadding) / props.dimensions.height
    setZoom(clampZoom(Math.min(widthScale, heightScale)))
  }
  const imageStyle = props.dimensions === undefined
    ? { width: `${zoom * 100}%` }
    : { width: `${props.dimensions.width * zoom}px` }
  const dialogLabel = props.title === undefined ? props.labels.expandedView : `${props.title} — ${props.labels.expandedView}`
  return (
    <div
      ref={overlayRef}
      className={css.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={dialogLabel}
      onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose() }}
    >
      <header className={css.lightboxToolbar}>
        <div className={css.lightboxTitle}>
          <strong>{dialogLabel}</strong>
          <span>{props.labels.dragToPan}</span>
        </div>
        <div className={css.zoomControls}>
          <button type="button" onClick={() => { setZoom(value => clampZoom(value - ZOOM_STEP)) }} disabled={zoom <= MIN_ZOOM} aria-label={props.labels.zoomOut}>−</button>
          <button type="button" onClick={() => { setZoom(1) }} aria-label={props.labels.resetZoom}>{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => { setZoom(value => clampZoom(value + ZOOM_STEP)) }} disabled={zoom >= MAX_ZOOM} aria-label={props.labels.zoomIn}>+</button>
          <button type="button" onClick={fitToWindow}>{props.labels.fit}</button>
          <button ref={closeRef} type="button" onClick={props.onClose}>{props.labels.close} ×</button>
        </div>
      </header>
      <div
        ref={canvasRef}
        className={`${css.lightboxCanvas} ${panning ? css.lightboxCanvasPanning : ''}`}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={(event) => { finishPan(event, false) }}
        onPointerCancel={(event) => { finishPan(event, true) }}
        onLostPointerCapture={losePanCapture}
      >
        <div ref={stageRef} className={css.lightboxStage}>
          <img className={css.expandedPreview} style={imageStyle} src={props.previewUrl} alt={props.alt ?? ''} draggable={false} />
        </div>
      </div>
    </div>
  )
}

function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

function sanitizePreview(preview: VisualizationFrameProps['preview']): { readonly svg?: string; readonly dimensions?: SvgDimensions; readonly error?: string } {
  if (preview === undefined) return {}
  try {
    const svg = sanitizeVisualizationSvg(preview.svg, preview.renderer)
    const dimensions = readSvgDimensions(svg)
    return dimensions === undefined ? { svg } : { svg, dimensions }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'SVG sanitization failed' }
  }
}

function readSvgDimensions(svg: string): SvgDimensions | undefined {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2]! > 0 && viewBox[3]! > 0) {
    return { width: viewBox[2]!, height: viewBox[3]! }
  }
  const width = numericDimension(root.getAttribute('width'))
  const height = numericDimension(root.getAttribute('height'))
  return width === undefined || height === undefined ? undefined : { width, height }
}

function numericDimension(value: string | null): number | undefined {
  if (value === null || !/^\d+(?:\.\d+)?(?:px)?$/.test(value.trim())) return undefined
  const numeric = Number.parseFloat(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined
}

function safeFilename(title: string | undefined): string {
  const safe = (title ?? 'visualization').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '')
  return safe || 'visualization'
}
