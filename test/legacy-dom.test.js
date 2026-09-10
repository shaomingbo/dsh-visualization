import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPreviewClaim,
  installLegacyEnhancer,
  LEGACY_VISUALIZATION_FENCES,
  readLegacyFenceTarget,
  readPreviewClaimState,
} from '../src/client/legacy-dom.ts'

class FakeElement {
  constructor(tagName, textContent = '') {
    this.tagName = tagName.toUpperCase()
    this.textContent = textContent
    this.children = []
    this.parentElement = null
    this.previousElementSibling = null
    this.attributes = new Map()
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this
      child.previousElementSibling = this.children.at(-1) ?? null
      this.children.push(child)
    }
  }

  hasAttribute(name) {
    return this.attributes.has(name)
  }

  setAttribute(name, value = '') {
    this.attributes.set(name, value)
  }

  closest(selector) {
    const match = /^\[([^=\]]+)(?:="([^"]+)")?\]$/.exec(selector)
    if (match === null) throw new Error(`unexpected selector ${selector}`)
    const [, name, value] = match
    for (let node = this; node !== null; node = node.parentElement) {
      if (node.hasAttribute(name) && (value === undefined || node.attributes.get(name) === value)) return node
    }
    return null
  }
}

function codeBlock(language, source, { streaming = false, assistantStep = true } = {}) {
  const assistant = new FakeElement('div')
  if (assistantStep) assistant.setAttribute('data-chat-flow-kind', 'assistant-step')
  if (streaming) assistant.setAttribute('data-streaming', 'true')
  const shell = new FakeElement('div')
  const header = new FakeElement('div')
  const label = new FakeElement('div', language)
  const actions = new FakeElement('div')
  actions.append(new FakeElement('button', '复制'))
  header.append(label, actions)
  const pre = new FakeElement('pre')
  const code = new FakeElement('code', source)
  pre.append(code)
  shell.append(header, pre)
  assistant.append(shell)
  return { assistant, shell, code }
}

test('legacy target reads normalized fence language and code text without HTML', () => {
  const { shell, code } = codeBlock('C4Context', 'flowchart LR\nA --> B')
  const target = readLegacyFenceTarget(code)
  assert.deepEqual(target, {
    language: 'c4context',
    source: 'flowchart LR\nA --> B',
    shell,
  })
})

test('legacy target recognizes the static dsh-svg fence', () => {
  const { code } = codeBlock('dsh-svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  const target = readLegacyFenceTarget(code)
  assert.ok(target !== null)
  assert.equal(target.language, 'dsh-svg')
  // The lower-cased DOM language must route through the static policy.
  assert.equal(LEGACY_VISUALIZATION_FENCES.has(target.language), true)
})

test('legacy target ignores user, streaming, and unsupported code blocks', () => {
  assert.equal(readLegacyFenceTarget(codeBlock('mermaid', 'flowchart LR\nA --> B', { assistantStep: false }).code), null)
  assert.equal(readLegacyFenceTarget(codeBlock('mermaid', 'flowchart LR\nA --> B', { streaming: true }).code), null)
  assert.equal(readLegacyFenceTarget(codeBlock('javascript', 'alert(1)').code), null)
})

test('legacy enhancer reports renderer failures and leaves the source unclaimed', () => {
  const errors = []
  const stop = installLegacyEnhancer({
    scan: () => [{ key: {}, signature: 'mermaid\u0000A' }],
    mount() { throw new Error('render failed') },
    observe: () => () => {},
    schedule: queueMicrotask,
    onError(phase, error) { errors.push([phase, error.message]) },
  })
  assert.deepEqual(errors, [['mount', 'render failed']])
  stop()
})

test('legacy enhancer mounts once, refreshes changed sources, and cleans every claim', () => {
  const key = {}
  let targets = [{ key, signature: 'mermaid\u0000A' }]
  const mounted = []
  const disposed = []
  const scheduled = []
  let notify = () => {}
  let disconnected = false

  const stop = installLegacyEnhancer({
    scan: () => targets,
    mount(target) {
      mounted.push(target.signature)
      return () => disposed.push(target.signature)
    },
    observe(listener) {
      notify = listener
      return () => { disconnected = true }
    },
    schedule(task) {
      scheduled.push(task)
    },
  })

  assert.deepEqual(mounted, ['mermaid\u0000A'])
  notify()
  notify()
  assert.equal(scheduled.length, 1)
  scheduled.shift()()
  assert.deepEqual(mounted, ['mermaid\u0000A'])

  targets = [{ key, signature: 'mermaid\u0000B' }]
  notify()
  scheduled.shift()()
  assert.deepEqual(disposed, ['mermaid\u0000A'])
  assert.deepEqual(mounted, ['mermaid\u0000A', 'mermaid\u0000B'])

  targets = []
  notify()
  scheduled.shift()()
  assert.deepEqual(disposed, ['mermaid\u0000A', 'mermaid\u0000B'])

  stop()
  assert.equal(disconnected, true)
})

test('preview claim state requires a decoded image, not just a node', () => {
  // Still decoding: the Host source must stay visible.
  assert.equal(readPreviewClaimState({ complete: false, naturalWidth: 0 }), 'pending')
  assert.equal(readPreviewClaimState({}), 'pending')
  // Decoded with intrinsic size: the static protocol mandates a viewBox, so
  // success always yields a nonzero size.
  assert.equal(readPreviewClaimState({ complete: true, naturalWidth: 240 }), 'ready')
  assert.equal(readPreviewClaimState({ complete: true, naturalWidth: 0 }), 'failed')
})

/** Minimal `<img>` fake: decode state, attachment flag, and load listeners. */
class FakePreviewImage {
  constructor({ complete = false, naturalWidth = 0, isConnected = true } = {}) {
    this.complete = complete
    this.naturalWidth = naturalWidth
    this.isConnected = isConnected
    this.watchers = []
  }

  addEventListener(type, listener, options) {
    this.watchers.push({ listener, once: options?.once === true })
  }

  removeEventListener(type, listener) {
    this.watchers = this.watchers.filter(entry => entry.listener !== listener)
  }

  /** Simulate the decode settling; `once` listeners are consumed like the DOM does. */
  decode(naturalWidth = 240) {
    this.complete = true
    this.naturalWidth = naturalWidth
    for (const entry of this.watchers.splice(0)) entry.listener()
  }
}

test('preview claim gate claims a ready image and a completed decode', () => {
  let claims = 0
  const gate = createPreviewClaim(() => { claims += 1 }, () => true)
  // A ready image claims immediately.
  gate.consider(new FakePreviewImage({ complete: true, naturalWidth: 240 }))
  assert.equal(claims, 1)
  // A pending image claims when its decode completes.
  const pending = new FakePreviewImage()
  gate.consider(pending)
  assert.equal(claims, 1)
  pending.decode()
  assert.equal(claims, 2)
  // A failed decode never claims.
  gate.consider(new FakePreviewImage({ complete: true, naturalWidth: 0 }))
  assert.equal(claims, 2)
})

test('preview claim gate ignores a late load callback after disposal', () => {
  const claims = []
  const gate = createPreviewClaim(() => { claims.push('claim') }, () => true)
  const pending = new FakePreviewImage()
  gate.consider(pending)
  assert.deepEqual(claims, [])
  // The load callback can already be queued when cleanup runs: even though
  // the listener was removed, the callback still fires — and must not claim.
  const lateLoad = pending.watchers[0].listener
  gate.dispose()
  lateLoad()
  assert.deepEqual(claims, [])
  // A decode completing after disposal stays equally inert.
  pending.decode()
  assert.deepEqual(claims, [])
})

test('preview claim gate requires a live mount and an attached image', () => {
  let live = true
  const claims = []
  const gate = createPreviewClaim(() => { claims.push('claim') }, () => live)
  // Mount removed between watch and decode: no claim.
  const pending = new FakePreviewImage()
  gate.consider(pending)
  live = false
  pending.decode()
  assert.deepEqual(claims, [])
  // Image detached from the mount: no claim even on a live mount.
  live = true
  const detached = new FakePreviewImage()
  detached.isConnected = false
  gate.consider(detached)
  detached.decode()
  assert.deepEqual(claims, [])
  // A ready image on a dead mount never claims either.
  gate.consider(new FakePreviewImage({ complete: true, naturalWidth: 240, isConnected: false }))
  assert.deepEqual(claims, [])
})

test('preview claim gate watches one pending image at a time without stacking listeners', () => {
  const claims = []
  const gate = createPreviewClaim(() => { claims.push('claim') }, () => true)
  const image = new FakePreviewImage()
  gate.consider(image)
  gate.consider(image)
  assert.equal(image.watchers.length, 1)
  // A replaced image detaches the stale watch and adopts the new decode.
  const replacement = new FakePreviewImage()
  gate.consider(replacement)
  assert.equal(image.watchers.length, 0)
  assert.equal(replacement.watchers.length, 1)
  image.decode()
  assert.deepEqual(claims, [])
  replacement.decode()
  assert.deepEqual(claims, ['claim'])
})
