interface QueueItem<T> {
  readonly run: (signal: AbortSignal) => Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason: unknown) => void
  readonly controller: AbortController
  cancelled: boolean
}

/** Cancellation handle for one serialized operation. */
export interface QueueOperation<T> {
  readonly result: Promise<T>
  cancel(): void
}

/**
 * Serialize an async global runtime and cap work waiting behind its active call.
 * Cancellation removes pending work; active work settles silently for its caller.
 */
export class SerializedQueue {
  readonly #maxPending: number
  readonly #items: Array<QueueItem<unknown>> = []
  #active = false

  constructor(maxPending: number) {
    this.#maxPending = maxPending
  }

  /** Number of calls waiting behind the active operation. */
  get pending(): number {
    return this.#items.length
  }

  /** Whether one operation owns the runtime. */
  get active(): boolean {
    return this.#active
  }

  /**
   * Enqueue one call or reject it immediately when all pending slots are occupied.
   * @param run - the abortable operation to serialize.
   * @returns a result and cancellation handle for the operation.
   */
  enqueue<T>(run: (signal: AbortSignal) => Promise<T>): QueueOperation<T> {
    if (this.#active && this.#items.length >= this.#maxPending) {
      return { result: Promise.reject(new Error('Visualization renderer is busy')), cancel() {} }
    }
    let item!: QueueItem<T>
    const result = new Promise<T>((resolve, reject) => {
      item = { run, resolve, reject, controller: new AbortController(), cancelled: false }
      this.#items.push(item as QueueItem<unknown>)
      this.#drain()
    })
    return {
      result,
      cancel: () => {
        item.cancelled = true
        item.controller.abort()
        const index = this.#items.indexOf(item as QueueItem<unknown>)
        if (index >= 0) {
          this.#items.splice(index, 1)
          item.reject(new DOMException('Visualization cancelled', 'AbortError'))
        }
      },
    }
  }

  #drain(): void {
    if (this.#active) return
    const item = this.#items.shift()
    if (item === undefined) return
    if (item.cancelled) {
      this.#drain()
      return
    }
    this.#active = true
    // Enter through a promise boundary so a synchronous renderer/Worker
    // constructor failure follows the same rejection and drain path.
    void Promise.resolve()
      .then(() => item.run(item.controller.signal))
      .then(item.resolve, item.reject)
      .finally(() => {
        this.#active = false
        this.#drain()
      })
  }
}
