import { LIMITS } from './limits.ts'
import type { QueueOperation } from './queue.ts'
import { SerializedQueue } from './queue.ts'
import { isVegaWorkerResponse, type VegaWorkerRequest, type VisualizationPalette } from './worker-protocol.ts'

const queue = new SerializedQueue(LIMITS.queuePending)
const WORKER_URL = '/plugins/dsh-visualization/vega-lite.worker.js'
let requestSequence = 0

/**
 * Queue one one-shot Vega worker behind the package-wide concurrency limit.
 * @param spec - validated inline-only Vega-Lite specification.
 * @param palette - trusted theme palette read from DSH tokens.
 * @returns a cancellation handle resolving to the rendered SVG string.
 */
export function renderVegaInWorker(spec: Record<string, unknown>, palette: VisualizationPalette): QueueOperation<string> {
  return queue.enqueue(signal => startWorker(spec, palette, signal))
}

function startWorker(spec: Record<string, unknown>, palette: VisualizationPalette, signal: AbortSignal): Promise<string> {
  if (signal.aborted) return Promise.reject(new DOMException('Visualization cancelled', 'AbortError'))
  const id = `vega-${++requestSequence}`
  const worker = new Worker(WORKER_URL, { type: 'module' })
  return new Promise<string>((resolve, reject) => {
    let settled = false
    const finish = (result: { readonly ok: true; readonly svg: string } | { readonly ok: false; readonly error: Error }) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      worker.removeEventListener('message', message)
      worker.removeEventListener('error', failed)
      worker.removeEventListener('messageerror', invalidMessage)
      worker.terminate()
      if (result.ok) resolve(result.svg)
      else reject(result.error)
    }
    const abort = () => { finish({ ok: false, error: new DOMException('Visualization cancelled', 'AbortError') }) }
    const message = (event: MessageEvent<unknown>) => {
      if (!isVegaWorkerResponse(event.data, id)) {
        finish({ ok: false, error: new Error('Invalid Vega worker response') })
        return
      }
      if (event.data.kind === 'failure') finish({ ok: false, error: new Error(event.data.error) })
      else finish({ ok: true, svg: event.data.svg })
    }
    const failed = () => { finish({ ok: false, error: new Error('Vega worker failed') }) }
    const invalidMessage = () => { finish({ ok: false, error: new Error('Vega worker response could not be decoded') }) }
    const timeout = window.setTimeout(() => {
      finish({ ok: false, error: new Error(`Vega-Lite rendering exceeded ${LIMITS.workerTimeoutMs} ms`) })
    }, LIMITS.workerTimeoutMs)
    signal.addEventListener('abort', abort, { once: true })
    worker.addEventListener('message', message)
    worker.addEventListener('error', failed)
    worker.addEventListener('messageerror', invalidMessage)
    const request: VegaWorkerRequest = { kind: 'render', id, spec, palette }
    worker.postMessage(request)
  })
}
