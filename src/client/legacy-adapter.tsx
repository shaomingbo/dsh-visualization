import { createRoot } from 'react-dom/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { VisualizationTheme } from '../types.ts'
import { LegacyCodeBlock } from './LegacyCodeBlock.tsx'
import type { Translate } from './LegacyCodeBlock.tsx'
import type { DataTableKey, MermaidKey, VegaLiteKey } from './locales.ts'
import {
  installLegacyEnhancer,
  readLegacyFenceTarget,
  type LegacyEnhancerTarget,
} from './legacy-dom.ts'

const LEGACY_MARKER = 'data-dsh-visualization-legacy'

interface DomEnhancerTarget extends LegacyEnhancerTarget {
  readonly key: HTMLElement
  readonly language: string
  readonly source: string
}

export interface LegacyDomAdapterOptions {
  readonly theme: ObservableSnapshot<VisualizationTheme>
  readonly tMermaid: Translate<MermaidKey>
  readonly tDataTable: Translate<DataTableKey>
  readonly tVegaLite: Translate<VegaLiteKey>
}

/** Install the fail-open rc.2 DOM adapter and return its complete cleanup. */
export function installLegacyDomAdapter(options: LegacyDomAdapterOptions): () => void {
  return installLegacyEnhancer<DomEnhancerTarget>({
    scan: scanLegacyTargets,
    mount(target) {
      const mount = document.createElement('div')
      mount.setAttribute(LEGACY_MARKER, '')
      mount.dataset.language = target.language
      target.key.insertAdjacentElement('afterend', mount)
      const wasHidden = target.key.hidden
      let claimed = false
      const claimPreview = () => {
        if (claimed || mount.querySelector('img[src^="blob:"], table') === null) return
        claimed = true
        target.key.hidden = true
      }
      const previewObserver = new MutationObserver(claimPreview)
      previewObserver.observe(mount, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] })
      const root = createRoot(mount)
      try {
        root.render(<LegacyCodeBlock
          language={target.language}
          source={target.source}
          theme={options.theme}
          tMermaid={options.tMermaid}
          tDataTable={options.tDataTable}
          tVegaLite={options.tVegaLite}
        />)
      } catch (error) {
        previewObserver.disconnect()
        root.unmount()
        mount.remove()
        target.key.hidden = wasHidden
        throw error
      }
      return () => {
        previewObserver.disconnect()
        try {
          root.unmount()
        } finally {
          mount.remove()
          target.key.hidden = wasHidden
        }
      }
    },
    observe(refresh) {
      const observer = new MutationObserver(refresh)
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['data-streaming'],
      })
      const interval = window.setInterval(refresh, 1_000)
      return () => {
        observer.disconnect()
        window.clearInterval(interval)
      }
    },
    schedule(task) { window.setTimeout(task, 0) },
    onError(phase, error) {
      console.warn(`[dsh-visualization] legacy ${phase} failed; keeping source`, error)
    },
  })
}

function scanLegacyTargets(): readonly DomEnhancerTarget[] {
  const targets: DomEnhancerTarget[] = []
  for (const code of document.querySelectorAll<HTMLElement>('pre > code')) {
    if (code.closest(`[${LEGACY_MARKER}]`) !== null) continue
    const fence = readLegacyFenceTarget(code)
    if (fence === null || !(fence.shell instanceof HTMLElement) || !fence.shell.isConnected) continue
    targets.push({
      key: fence.shell,
      signature: `${fence.language}\u0000${fence.source}`,
      language: fence.language,
      source: fence.source,
    })
  }
  return targets
}
