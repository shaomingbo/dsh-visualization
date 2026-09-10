import { isMermaidFence, MERMAID_FENCE_HEADERS } from '../mermaid-policy.ts'

/** Fence languages the legacy DOM adapter may claim. */
export const LEGACY_VISUALIZATION_FENCES = Object.freeze(new Set([
  'mermaid',
  'text',
  ...Object.keys(MERMAID_FENCE_HEADERS),
  'csv',
  'tsv',
  'json-table',
  'vega-lite',
  'dsh-svg',
]))

/** Minimal DOM face used by the structural fence reader and its tests. */
export interface LegacyElement {
  readonly tagName: string
  readonly textContent: string | null
  readonly children: ArrayLike<LegacyElement>
  readonly parentElement: LegacyElement | null
  readonly previousElementSibling: LegacyElement | null
  closest?(selector: string): LegacyElement | null
}

/** One settled supported code block discovered in the legacy Harness DOM. */
export interface LegacyFenceTarget {
  readonly language: string
  readonly source: string
  readonly shell: LegacyElement
}

/**
 * Read a supported settled fence from the semantic code-block structure used by
 * legacy Harness releases. Syntax-highlighted spans are intentionally ignored:
 * source always comes from `code.textContent`.
 */
export function readLegacyFenceTarget(code: LegacyElement): LegacyFenceTarget | null {
  if (code.tagName.toUpperCase() !== 'CODE') return null
  if (code.closest?.('[data-chat-flow-kind="assistant-step"]') === null) return null
  if (code.closest?.('[data-streaming]') !== null) return null
  const pre = code.parentElement
  if (pre?.tagName.toUpperCase() !== 'PRE') return null
  const shell = pre.parentElement
  const header = pre.previousElementSibling
  if (shell === null || header === null || header.parentElement !== shell) return null
  const language = findFenceLanguage(header)
  if (language === undefined) return null
  const source = code.textContent ?? ''
  if (language === 'text' && !isMermaidFence(language, source)) return null
  return { language, source, shell }
}

function findFenceLanguage(header: LegacyElement): string | undefined {
  const pending = Array.from(header.children)
  while (pending.length > 0) {
    const element = pending.shift()
    if (element === undefined || element.tagName.toUpperCase() === 'BUTTON') continue
    const language = (element.textContent ?? '').trim().toLowerCase()
    if (LEGACY_VISUALIZATION_FENCES.has(language)) return language
    pending.unshift(...Array.from(element.children))
  }
  return undefined
}

/** Stable identity and content signature consumed by the lifecycle reconciler. */
export interface LegacyEnhancerTarget {
  readonly key: object
  readonly signature: string
}

/** Decode state of one preview image. */
export type PreviewClaimState = 'ready' | 'failed' | 'pending'

/**
 * Decide whether one blob-preview image proves a successful render. The
 * static protocol mandates a viewBox, so a decoded SVG always reports a
 * nonzero intrinsic size; a failed decode reports `error`/zero size.
 * @param image - the preview `<img>` (structural face for tests).
 * @returns whether the preview is ready, failed, or still decoding.
 */
export function readPreviewClaimState(image: { complete?: boolean; naturalWidth?: number }): PreviewClaimState {
  if (image.complete !== true) return 'pending'
  return (image.naturalWidth ?? 0) > 0 ? 'ready' : 'failed'
}

/** Structural `<img>` face consumed by the claim gate (tests supply fakes). */
export interface PreviewClaimImage {
  readonly complete?: boolean
  readonly naturalWidth?: number
  isConnected?: boolean
  addEventListener?: (type: 'load', listener: () => void, options?: { once: boolean }) => void
  removeEventListener?: (type: 'load', listener: () => void, options?: { once: boolean }) => void
}

/** Liveness-gated claim control for one mount's preview images. */
export interface PreviewClaimGate {
  /** Re-evaluate one preview image; attaches a pending watch when needed. */
  consider(image: PreviewClaimImage): void
  /** Stop watching and stop claiming; late load callbacks are ignored. */
  dispose(): void
}

/**
 * Gate the Host-source claim behind a decoded image and a live mount. A `load`
 * callback may still arrive after the mount was disposed — the event can be
 * queued when cleanup runs — so the watch is removed on dispose and every
 * callback re-checks mount liveness and image attachment before claiming.
 * @param claim - hides the Host source; expected to be idempotent.
 * @param isLive - whether the owning mount is still installed.
 * @returns the claim gate for the mount's lifetime.
 */
export function createPreviewClaim(claim: () => void, isLive: () => boolean): PreviewClaimGate {
  let disposed = false
  let watched: PreviewClaimImage | undefined
  let onWatchedLoad: (() => void) | undefined
  const detach = () => {
    if (watched !== undefined && onWatchedLoad !== undefined) {
      watched.removeEventListener?.('load', onWatchedLoad, { once: true })
    }
    watched = undefined
    onWatchedLoad = undefined
  }
  return {
    consider(image) {
      if (disposed) return
      const state = readPreviewClaimState(image)
      if (state === 'pending') {
        if (watched === image) return // already watching this decode
        detach()
        watched = image
        onWatchedLoad = () => {
          // A callback already queued when dispose ran must not claim, and a
          // detached image no longer backs a live preview.
          if (watched !== image || !isLive() || image.isConnected !== true) return
          if (readPreviewClaimState(image) === 'ready') claim()
        }
        image.addEventListener?.('load', onWatchedLoad, { once: true })
        return
      }
      detach()
      if (state === 'ready') {
        // The same liveness and attachment checks as the load callback: the
        // observer may run between disposal steps or on a replaced image.
        if (!isLive() || image.isConnected !== true) return
        claim()
      }
    },
    dispose() {
      disposed = true
      detach()
    },
  }
}

/** Dependencies for the DOM-independent legacy claim lifecycle. */
export interface LegacyEnhancerOptions<T extends LegacyEnhancerTarget> {
  scan(): readonly T[]
  mount(target: T): () => void
  observe(refresh: () => void): () => void
  schedule(task: () => void): void
  onError?(phase: 'scan' | 'mount' | 'observe', error: unknown): void
}

/**
 * Reconcile legacy visualization claims without duplicating mounts. Unknown DOM,
 * observer failures, and renderer failures all fail open to the native source.
 */
export function installLegacyEnhancer<T extends LegacyEnhancerTarget>(
  options: LegacyEnhancerOptions<T>,
): () => void {
  const active = new Map<object, { signature: string; dispose: () => void }>()
  let scheduled = false
  let stopped = false

  const reconcile = () => {
    if (stopped) return
    let targets: readonly T[]
    try {
      targets = options.scan()
    } catch (error) {
      options.onError?.('scan', error)
      return
    }
    const incoming = new Map(targets.map(target => [target.key, target]))
    for (const [key, mounted] of active) {
      const target = incoming.get(key)
      if (target !== undefined && target.signature === mounted.signature) continue
      mounted.dispose()
      active.delete(key)
    }
    for (const target of incoming.values()) {
      if (active.has(target.key)) continue
      try {
        active.set(target.key, {
          signature: target.signature,
          dispose: options.mount(target),
        })
      } catch (error) {
        // A failed optional enhancement deliberately leaves the source untouched.
        options.onError?.('mount', error)
      }
    }
  }

  const refresh = () => {
    if (stopped || scheduled) return
    scheduled = true
    options.schedule(() => {
      scheduled = false
      reconcile()
    })
  }

  reconcile()
  let disconnect = () => {}
  try {
    disconnect = options.observe(refresh)
  } catch (error) {
    // Initial enhancement may still be useful; absence of an observer is nonfatal.
    options.onError?.('observe', error)
  }

  return () => {
    if (stopped) return
    stopped = true
    disconnect()
    for (const mounted of active.values()) mounted.dispose()
    active.clear()
  }
}
