/// <reference lib="webworker" />

import { View, parse, type Loader } from 'vega'
import { compile, type TopLevelSpec } from 'vega-lite'
import { expressionInterpreter } from 'vega-interpreter'
import { validateCompiledVega, validateVegaLiteSpec } from './vega-policy.ts'
import { isVegaWorkerRequest, type VegaWorkerResponse } from './worker-protocol.ts'

const scope = self as DedicatedWorkerGlobalScope
const deny = (): Promise<never> => Promise.reject(new Error('External loading is disabled'))
const denyLoader: Loader = {
  load: deny,
  sanitize: deny,
  http: deny,
  file: deny,
}
let handled = false

scope.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (handled) return
  handled = true
  void render(event.data).then((response) => {
    scope.postMessage(response)
    scope.close()
  })
})

async function render(data: unknown): Promise<VegaWorkerResponse> {
  const id = isVegaWorkerRequest(data) ? data.id : 'invalid'
  if (!isVegaWorkerRequest(data)) return { kind: 'failure', id, error: 'Invalid Vega worker request' }
  let view: View | undefined
  try {
    const spec = validateVegaLiteSpec(data.spec)
    const compiled = compile(spec as unknown as TopLevelSpec, {
      config: {
        background: data.palette.background,
        axis: {
          domainColor: data.palette.border,
          gridColor: data.palette.border,
          labelColor: data.palette.muted,
          titleColor: data.palette.foreground,
        },
        legend: { labelColor: data.palette.muted, titleColor: data.palette.foreground },
        mark: { color: data.palette.accent },
        title: { color: data.palette.foreground },
        view: { stroke: data.palette.border },
      },
    }).spec
    validateCompiledVega(compiled)
    const runtime = parse(compiled, {}, { ast: true })
    view = new View(runtime, {
      expr: expressionInterpreter,
      loader: denyLoader,
      renderer: 'none',
    })
    await view.runAsync()
    const svg = await view.toSVG()
    return { kind: 'success', id, svg }
  } catch (error) {
    return { kind: 'failure', id, error: error instanceof Error ? error.message : 'Vega-Lite rendering failed' }
  } finally {
    if (view !== undefined) view.finalize()
  }
}
