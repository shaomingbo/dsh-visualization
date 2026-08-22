import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MERMAID_FENCE_HEADERS,
  detectMermaidHeader,
  isMermaidFence,
  prepareMermaidSource,
  resolveMermaidFenceHeader,
  validateMermaidSource,
} from '../src/mermaid-policy.ts'

const directFences = [
  ['kanban', 'kanban', 'todo[Todo]\n  task1[Theme upgrade]'],
  ['quadrantchart', 'quadrantChart', 'x-axis Low --> High\ny-axis Low --> High\nA: [0.4, 0.7]'],
  ['c4context', 'C4Context', 'Person(user, "User")\nSystem(app, "App")\nRel(user, app, "Uses")'],
  ['requirementdiagram', 'requirementDiagram', 'requirement secure_login {\nid: "REQ-1"\ntext: "Secure login"\nrisk: high\nverifymethod: test\n}'],
]

test('normalized direct Mermaid fences map to canonical headers', () => {
  for (const [language, header] of directFences) {
    assert.equal(MERMAID_FENCE_HEADERS[language], header)
    assert.equal(resolveMermaidFenceHeader(language.toUpperCase()), header)
  }
  assert.equal(resolveMermaidFenceHeader('mermaid'), undefined)
})

test('text fences are claimed only when their body starts with a supported Mermaid header', () => {
  assert.equal(detectMermaidHeader('  C4Context\nPerson(user, "User")'), 'C4Context')
  assert.equal(isMermaidFence('text', 'C4Context\nPerson(user, "User")'), true)
  assert.equal(isMermaidFence('text', 'ordinary prose\nthat must remain code'), false)
  assert.equal(isMermaidFence('text', 'xychart-beta\nbar [1, 2]'), false)
})

test('C4 render input gets compact trusted layout defaults without changing source text', () => {
  const prepared = prepareMermaidSource('C4Context\nPerson(user, "User")', undefined)
  assert.match(prepared, /^C4Context\nUpdateLayoutConfig\(\$c4ShapeInRow="3", \$c4BoundaryInRow="1"\)/)
  assert.equal(prepareMermaidSource(prepared, undefined), prepared)
})

test('direct subtype sources gain exactly one canonical header and validate', () => {
  for (const [, header, body] of directFences) {
    const prepared = prepareMermaidSource(body, header)
    assert.equal(prepared.startsWith(`${header}\n`), true)
    assert.equal(validateMermaidSource(prepared), prepared)
    assert.equal(prepareMermaidSource(prepared, header), prepared)
  }
})

test('mismatched direct fence header fails without changing displayed source', () => {
  assert.throws(
    () => prepareMermaidSource('quadrantChart\nx-axis Low --> High', 'kanban'),
    /expects kanban but source starts with quadrantChart/,
  )
})

test('legacy br labels become inert private text without changing copied source', () => {
  const source = 'flowchart LR\nA["Web GUI<br/>Vite"] --> B'
  const prepared = prepareMermaidSource(source, undefined)
  assert.equal(prepared, 'flowchart LR\nA["Web GUI · Vite"] --> B')
  assert.equal(validateMermaidSource(prepared), prepared)
  assert.match(source, /<br\/>/)
  assert.equal(prepareMermaidSource('item["One<br>Two"]', 'kanban'), 'kanban\nitem["One · Two"]')
})

test('Mermaid policy still rejects active document features', () => {
  for (const source of [
    '---\ntitle: unsafe\n---\nflowchart LR\nA --> B',
    'flowchart LR\n%%{init: {"theme": "dark"}}%%\nA --> B',
    'flowchart LR\nA[<b>unsafe</b>] --> B',
    'flowchart LR\nA --> B\nclick A "https://example.com"',
    'flowchart LR\nA --> B\nstyle A fill:red',
  ]) {
    assert.throws(() => validateMermaidSource(source))
  }
})
