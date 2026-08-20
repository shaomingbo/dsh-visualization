import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { VisualizationPalette } from './worker-protocol.ts'
import type { VisualizationTheme } from './types.ts'

/** Visibility state used to defer renderer loading. */
export type Visibility = 'waiting' | 'visible' | 'unsupported'

/**
 * Observe first visibility without loading a renderer for offscreen or streaming content.
 * @param settled - whether the visualization source has finished streaming.
 * @returns the observed element ref and its visibility state.
 */
export function useSettledVisibility(settled: boolean): [RefObject<HTMLDivElement>, Visibility] {
  const ref = useRef<HTMLDivElement>(null)
  const [visibility, setVisibility] = useState<Visibility>('waiting')
  useEffect(() => {
    if (!settled || visibility !== 'waiting') return
    if (typeof IntersectionObserver === 'undefined') {
      setVisibility('unsupported')
      return
    }
    const target = ref.current
    if (target === null) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisibility('visible')
        observer.disconnect()
      }
    })
    observer.observe(target)
    return () => { observer.disconnect() }
  }, [settled, visibility])
  return [ref, visibility]
}

/**
 * Materialize sanitized SVG as an image-only Blob URL and revoke replaced or unmounted URLs.
 * @param svg - sanitized SVG source, or undefined to clear the URL.
 * @returns the current Blob URL when source is available.
 */
export function useSvgUrl(svg: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (svg === undefined) {
      setUrl(undefined)
      return
    }
    const next = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    setUrl(next)
    return () => { URL.revokeObjectURL(next) }
  }, [svg])
  return url
}

/**
 * Read renderer colors from DSH semantic tokens whenever the plain theme identity changes.
 * @param theme - the current theme identity.
 * @returns semantic colors for visualization renderers.
 */
export function useVisualizationPalette(theme: VisualizationTheme): VisualizationPalette {
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement)
    const read = (token: string, fallback: string) => {
      const value = style.getPropertyValue(token).trim()
      return value || fallback
    }
    const fallback = theme.colorScheme === 'dark'
      ? {
          foreground: '#f4f4f5', muted: '#a1a1aa', accent: '#60a5fa',
          border: 'rgba(255,255,255,0.14)', background: '#18181b',
          surface: '#27272a', line: 'rgba(255,255,255,0.28)',
        }
      : {
          foreground: '#27272a', muted: '#71717a', accent: '#2563eb',
          border: 'rgba(24,24,27,0.14)', background: '#ffffff',
          surface: '#f4f4f5', line: 'rgba(24,24,27,0.30)',
        }
    return {
      foreground: read('--dsw-alias-label-primary', fallback.foreground),
      muted: read('--dsw-alias-label-secondary', fallback.muted),
      accent: read('--dsw-alias-brand-primary-new-colorprimary-new-color', fallback.accent),
      border: read('--dsw-alias-border-l2', fallback.border),
      background: read('--dsw-alias-bg-layer-1', fallback.background),
      surface: read('--dsw-alias-bg-layer-2', fallback.surface),
      line: read('--dsw-alias-border-l1', fallback.line),
      fontFamily: read('--dsw-font-family', 'system-ui, -apple-system, "Segoe UI", sans-serif'),
    }
  }, [theme.revision, theme.colorScheme])
}
