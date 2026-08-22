import assert from 'node:assert/strict'
import test from 'node:test'
import {
  installLegacyEnhancer,
  readLegacyFenceTarget,
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
