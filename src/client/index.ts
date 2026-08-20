/** Browser half of the Assistant visualization fence plugin. */
import type { ClientContext, ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { AssistantCodeBlockViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import { MERMAID_FENCE_HEADERS } from '../mermaid-policy.ts'
import type { VisualizationTheme } from '../types.ts'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { DataTableCodeBlock } from './DataTableCodeBlock.tsx'
import { MermaidCodeBlock } from './MermaidCodeBlock.tsx'
import { VegaLiteCodeBlock } from './VegaLiteCodeBlock.tsx'
import {
  DATA_TABLE_NS,
  dataTableEn,
  dataTableZh,
  MERMAID_NS,
  mermaidEn,
  mermaidZh,
  VEGA_LITE_NS,
  vegaLiteEn,
  vegaLiteZh,
  type DataTableKey,
  type MermaidKey,
  type VegaLiteKey,
} from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Mermaid visualization controls and status copy. */
    mermaid: MermaidKey
    /** Data-table filtering, sorting, empty-state, and pagination copy. */
    dataTable: DataTableKey
    /** Vega-Lite preview controls and status copy. */
    vegaLite: VegaLiteKey
  }
}

const CODE_BLOCK_SLOT = 'conversation.chat.assistant.codeBlock'
const TABLE_KEYS = ['csv', 'tsv', 'json-table'] as const satisfies readonly AssistantCodeBlockViewProps['language'][]
/** Normalized Mermaid fence languages that route to the same renderer. */
const MERMAID_KEYS = ['mermaid', 'text', ...Object.keys(MERMAID_FENCE_HEADERS)] satisfies readonly AssistantCodeBlockViewProps['language'][]

/** Required services for keyed renderers, dictionaries, and the live theme. */
export const inject = ['slots', 'locale', 'theme']

function visualizationTheme(snapshot: ThemeSnapshot): VisualizationTheme {
  return Object.freeze({ revision: snapshot.revision, colorScheme: snapshot.active.colorScheme })
}

/**
 * Register visualization dictionaries and all supported Assistant fence renderers.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.register(MERMAID_NS, { zh: mermaidZh, en: mermaidEn }),
    'dsh-visualization: Mermaid dictionaries',
  )
  ctx.effect(
    () => ctx.locale.register(DATA_TABLE_NS, { zh: dataTableZh, en: dataTableEn }),
    'dsh-visualization: data-table dictionaries',
  )
  ctx.effect(
    () => ctx.locale.register(VEGA_LITE_NS, { zh: vegaLiteZh, en: vegaLiteEn }),
    'dsh-visualization: Vega-Lite dictionaries',
  )

  let snapshot = visualizationTheme(ctx.theme.getTheme())
  const listeners = new Set<() => void>()
  const theme: ObservableSnapshot<VisualizationTheme> = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  ctx.on('theme/change', (next) => {
    snapshot = visualizationTheme(next)
    for (const listener of listeners) listener()
  })
  ctx.effect(() => () => { listeners.clear() }, 'dsh-visualization: theme subscribers')

  ctx.slots.inject(CODE_BLOCK_SLOT, function* () {
    for (const key of MERMAID_KEYS) {
      yield ctx.slots.register({
        name: CODE_BLOCK_SLOT,
        key,
        locale: MERMAID_NS,
        inject: () => ({ hooks: { theme } }),
      }, MermaidCodeBlock)
    }
    for (const key of TABLE_KEYS) {
      yield ctx.slots.register({
        name: CODE_BLOCK_SLOT,
        key,
        locale: DATA_TABLE_NS,
      }, DataTableCodeBlock)
    }
    yield ctx.slots.register({
      name: CODE_BLOCK_SLOT,
      key: 'vega-lite',
      locale: VEGA_LITE_NS,
      inject: () => ({ hooks: { theme } }),
    }, VegaLiteCodeBlock)
  })
}
