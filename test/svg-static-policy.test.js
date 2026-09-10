import assert from 'node:assert/strict'
import test from 'node:test'

// The static SVG policy runs against the platform DOM. Provide linkedom's
// implementation before importing the module under test.
const { DOMParser, Node: LinkedomNode } = await import('linkedom')
globalThis.DOMParser = DOMParser
globalThis.Node = LinkedomNode

const { sanitizeStaticSvg, sanitizeStaticSvgDocument, isStaticSvgFence } = await import('../src/svg-static-policy.ts')
const { LIMITS } = await import('../src/limits.ts')

function validSvg(body = '', { viewBox = '0 0 960 600', title = '架构总览', desc = '一张两节点架构图。' } = {}) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '" role="img" aria-labelledby="arch-title arch-desc">',
    `<title id="arch-title">${title}</title>`,
    `<desc id="arch-desc">${desc}</desc>`,
    '<defs><marker id="arch-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">',
    '<polygon points="0 0, 8 3, 0 6" fill="#4f5d75"/></marker></defs>',
    '<rect width="960" height="600" fill="#f5f5f5"/>',
    '<g><rect x="40" y="40" width="160" height="48" rx="6" fill="#ffffff" stroke="#2d3142"/>',
    '<text x="120" y="68" text-anchor="middle" font-size="12" font-family="-apple-system, \'PingFang SC\', sans-serif" fill="#2d3142">客户端</text></g>',
    '<path d="M 200 64 H 300" fill="none" stroke="#4f5d75" marker-end="url(#arch-arrow)"/>',
    body,
    '</svg>',
  ].join('\n')
}

function reject(source, message) {
  assert.throws(() => sanitizeStaticSvg(source), error => {
    assert.ok(error instanceof Error)
    if (message !== undefined) assert.match(error.message, new RegExp(message))
    return true
  })
}

test('valid static SVG passes and rewrites ids and references consistently', () => {
  const svg = sanitizeStaticSvg(validSvg())
  assert.match(svg, /viewBox="0 0 960 600"/)
  assert.match(svg, /<title[^>]*>架构总览<\/title>/)
  assert.match(svg, /dsh-svg-\d+-arch-title/)
  assert.match(svg, /aria-labelledby="dsh-svg-\d+-arch-title dsh-svg-\d+-arch-desc"/)
  assert.match(svg, /marker-end="url\(#dsh-svg-\d+-arch-arrow\)"/)
  // The rewritten id is actually defined on the title element.
  assert.match(svg, /<title id="dsh-svg-\d+-arch-title"/)
  // The accessible name is read from the validated document, not raw source.
  assert.equal(sanitizeStaticSvgDocument(validSvg()).title, '架构总览')
})

test('sanitized output survives the policy again (output re-validation contract)', () => {
  const first = sanitizeStaticSvg(validSvg())
  const second = sanitizeStaticSvg(first)
  // Ids are re-prefixed per sanitization; the structural guarantees must hold
  // on every pass and references must stay consistent.
  assert.match(second, /aria-labelledby="dsh-svg-\d+-dsh-svg-\d+-arch-title dsh-svg-\d+-dsh-svg-\d+-arch-desc"/)
  assert.equal(sanitizeStaticSvgDocument(second).title, '架构总览')
  assert.match(second, /marker-end="url\(#dsh-svg-\d+-dsh-svg-\d+-arch-arrow\)"/)
})

test('accessibility and marker references must resolve and stay markers', () => {
  reject(validSvg().replace(/marker-end="url\(#arch-arrow\)"/, 'marker-end="url(#missing)"'), 'marker')
  reject(validSvg('<g marker-end="url(#arch-title)"></g>'), 'marker')
  reject(validSvg().replace(/aria-labelledby="arch-title arch-desc"/, 'aria-labelledby="arch-title ghost"'), 'missing id')
})

test('duplicate ids and malformed id values are rejected', () => {
  reject(validSvg('<rect id="arch-title" width="4" height="4"/>'), 'duplicate id')
  reject(validSvg('<rect id="9bad" width="4" height="4"/>'), 'valid local id')
})

test('scripts, events, foreign objects, images, and active elements are rejected', () => {
  reject(validSvg('<script>alert(1)</script>'), 'element')
  reject(validSvg('<foreignObject width="10" height="10"></foreignObject>'), 'element')
  reject(validSvg('<image href="x.png"/>'), 'element')
  reject(validSvg('<use href="#x"/>'), 'element')
  reject(validSvg('<a href="https://example.com"><rect width="4" height="4"/></a>'), 'element')
  reject(validSvg('<animate attributeName="x" to="10"/>'), 'element')
  reject(validSvg('<set attributeName="x" to="10"/>'), 'element')
  reject(validSvg('<filter id="f"><feGaussianBlur/></filter>'), 'element')
  reject(validSvg('<pattern id="p" width="4" height="4"/>'), 'element')
  reject(validSvg('<rect onclick="alert(1)" width="4" height="4"/>'), 'event attribute')
})

test('style channels, class, and non-presentation attributes are rejected', () => {
  reject(validSvg('<style>rect{fill:red}</style>'), 'element')
  reject(validSvg('<rect style="fill:red" width="4" height="4"/>'), 'attribute style')
  reject(validSvg('<rect class="node" width="4" height="4"/>'), 'attribute class')
  reject(validSvg('<rect tabindex="0" width="4" height="4"/>'), 'attribute tabindex')
})

test('external references cannot survive in any attribute value', () => {
  reject(validSvg('<rect width="4" height="4" fill="url(https://example.com/x)"/>'), 'references')
  reject(validSvg('<text href="https://example.com">x</text>'), 'attribute href')
  reject(validSvg('<rect fill="url(data:image/png;base64,AAAA)" width="4" height="4"/>'), 'references')
  reject(validSvg('<g fill="url(#dots)"></g>'), 'only local marker')
  reject(validSvg().replace('xmlns="http://www.w3.org/2000/svg"', 'xmlns="http://example.com/svg"'), 'namespace')
  // Strict XML parsers reject the undeclared `svg:` prefix outright; DOM
  // shims may treat it as a literal tag name, which the allowlist rejects.
  reject(validSvg().replace('<title', '<svg:title').replace('</title>', '</svg:title>'))
})

test('namespaced attributes, comments, and processing instructions are rejected', () => {
  reject(validSvg('<rect xlink:href="#x" width="4" height="4"/>'), 'attribute')
  reject(validSvg('<rect unknown="1" width="4" height="4"/>'), 'attribute unknown')
  reject(validSvg('<!-- hidden payload -->'), 'comments')
  // Top-level processing instructions are legal XML but rejected by policy;
  // the DOM shim drops them, so the rejection is only assertable when the
  // parsed document keeps the node.
  {
    const document = new DOMParser().parseFromString('<?xml-stylesheet type="text/css" href="x.css"?>' + validSvg(), 'image/svg+xml')
    const preserved = [...document.childNodes].some(node => node.nodeType === 7)
    if (preserved) reject('<?xml-stylesheet type="text/css" href="x.css"?>' + validSvg(), 'processing')
  }
})

test('doctype and entity declarations are rejected on input and output', () => {
  reject('<!DOCTYPE svg [<!ENTITY x "y">]>' + validSvg(), 'DOCTYPE')
  reject('<?xml version="1.0"?><!DOCTYPE svg>' + validSvg(), 'DOCTYPE')
})

test('structural requirements: single svg root, viewBox, title first, desc present', () => {
  reject(validSvg().replace(/viewBox="[^"]*"/, ''), 'viewBox')
  reject(validSvg('', { viewBox: '0 0 960 0' }), 'positive')
  reject('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>', 'viewBox')
  reject(validSvg().replace(/<title[^>]*>[\s\S]*?<\/title>/, ''), 'title')
  reject(validSvg().replace(/<desc[^>]*>[\s\S]*?<\/desc>/, ''), 'desc')
  reject(validSvg().replace('<desc', '<g>').replace('</desc>', '</g>'), 'desc')
  const lateTitle = validSvg().replace(/<title id="arch-title">架构总览<\/title>\n/, '')
    .replace('</svg>', '<title id="arch-title">架构总览</title></svg>')
  reject(lateTitle, 'first child')
  reject('<g xmlns="http://www.w3.org/2000/svg"></g>', 'svg root')
})

test('resource limits are enforced with clear errors', () => {
  const big = '<g>' + '<rect width="4" height="4"/>'.repeat(2_000) + '</g>'
  assert.doesNotThrow(() => sanitizeStaticSvg(validSvg(big)))
  reject(validSvg('<g>'.repeat(40) + '<rect width="4" height="4"/>' + '</g>'.repeat(40)), 'nesting')
  const deepLimit = '<i></i>'.repeat(0) + validSvg('<g>'.repeat(33) + '</g>'.repeat(33))
  reject(deepLimit, 'nesting')
  reject(validSvg('<text>' + '字'.repeat(2_100) + '</text>'), 'text')
  reject(validSvg('<path d="' + 'M0 0 '.repeat(2_000) + '"/>'), 'bytes')
  reject(validSvg('', { viewBox: '0 0 40000 600' }), 'exceeds')
  assert.throws(() => sanitizeStaticSvg('x'.repeat(LIMITS.staticSvgSourceBytes + 1)), /source/)
})

test('marker-free documents are valid and title fallback works', () => {
  const minimal = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<title id="t">简单图</title>',
    '<desc id="d">一个方框。</desc>',
    '<rect x="20" y="20" width="60" height="60" fill="#ffffff"/>',
    '</svg>',
  ].join('\n')
  const svg = sanitizeStaticSvg(minimal)
  assert.equal(sanitizeStaticSvgDocument(minimal).title, '简单图')
  assert.match(svg, /dsh-svg-\d+-t/)
})

test('css escape sequences cannot disguise external references', () => {
  reject(validSvg('<rect width="4" height="4" fill="u\\72l(\'\\68ttps:\\2f\\2f example.com/paint.svg#g)"/>'), 'escape sequences')
  reject(validSvg('<rect width="4" height="4" fill="url(\\202f)"/>'), 'escape sequences')
})

test('numeric grammar and canvas bounds are enforced', () => {
  reject(validSvg('', { viewBox: '0 0 0x64 100' }), 'decimal SVG numbers')
  reject(validSvg('', { viewBox: '0 0 960 1e400' }), 'viewBox')
  reject('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" width="1000000000" height="1000000000"><title id="t">T</title><desc id="d">D</desc></svg>', 'root width')
  reject('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" width="100%"><title id="t">T</title><desc id="d">D</desc></svg>', 'root width')
  reject('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600"><title id="t">T</title><desc id="d">D</desc><g transform="translate(0,1e100)"/></svg>', 'exceeds 1000000')
  reject('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600"><title id="t">T</title><desc id="d">D</desc><path d="M 1e7 0"/></svg>', 'exceeds 1000000')
  // Percentages stay legal for inner element sizes relative to the viewport.
  assert.doesNotThrow(() => sanitizeStaticSvg(validSvg('<rect width="100%" height="100%" fill="none"/>')))
  assert.doesNotThrow(() => sanitizeStaticSvg(validSvg('<g transform="translate(8,8) rotate(45)"/>')))
})

test('padded local marker references are accepted and rewritten consistently', () => {
  const padded = validSvg().replace(/marker-end="url\(#arch-arrow\)"/, 'marker-end=" url(#arch-arrow) "')
  const svg = sanitizeStaticSvg(padded)
  const rewrittenId = /<marker id="(dsh-svg-\d+-arch-arrow)"/.exec(svg)?.[1]
  assert.ok(rewrittenId, 'marker id is renamed')
  assert.match(svg, new RegExp(`marker-end="url\\(#${rewrittenId}\\)"`))
})

test('fence language detection is case-insensitive and exclusive', () => {
  assert.equal(isStaticSvgFence('dsh-svg'), true)
  assert.equal(isStaticSvgFence('DSH-SVG'), true)
  assert.equal(isStaticSvgFence('svg'), false)
  assert.equal(isStaticSvgFence('xml'), false)
})

test('oversized input is rejected before any XML parsing', () => {
  // The size gate must run before the platform parser: an oversized document
  // must never be parsed on the main thread, including for title extraction.
  const original = globalThis.DOMParser
  let parses = 0
  class CountingParser {
    parseFromString(source, type) {
      parses += 1
      return new original().parseFromString(source, type)
    }
  }
  globalThis.DOMParser = CountingParser
  try {
    assert.throws(
      () => sanitizeStaticSvgDocument('x'.repeat(LIMITS.staticSvgSourceBytes + 1)),
      /exceeds 131072 UTF-8 bytes/,
    )
    assert.equal(parses, 0)
  } finally {
    globalThis.DOMParser = original
  }
})

test('exponent-bearing decimals keep their magnitude and stay bounded', () => {
  // `1.e100` is valid SVG number grammar: the full token must be measured,
  // not split into `1` and `100` by a partial extraction.
  const root = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600"><title id="t">T</title><desc id="d">D</desc>'
  reject(`${root}<g transform="translate(0,1.e100)"/></svg>`, 'exceeds 1000000')
  reject(`${root}<path d="M 1.e100 0 L 0 0"/></svg>`, 'exceeds 1000000')
  reject(`${root}<path d="M 1e 0"/></svg>`, 'invalid numeric syntax')
  reject(`${root}<path d="M 1.5x 0"/></svg>`, 'invalid numeric syntax')
  reject(validSvg('<rect x="10px" y="4" width="4" height="4"/>'), 'invalid numeric syntax')
  reject(validSvg('<g transform="translateX(10)"/>'), 'invalid numeric syntax')
  reject(validSvg('<g transform="rotate"/>'), 'invalid numeric syntax')
  reject(validSvg('<g transform="translate()"/>'), 'invalid numeric syntax')
  reject(validSvg('<g transform="translate(4"/>'), 'invalid numeric syntax')
  // Well-formed bounded values keep working: `1.` mantissa, paths, and lists.
  assert.doesNotThrow(() => sanitizeStaticSvg(validSvg('<rect x="40." y="4" width="4" height="4"/>')))
  assert.doesNotThrow(() => sanitizeStaticSvg(validSvg('<polyline points="0,0 8,3 0,6"/>')))
  assert.doesNotThrow(() => sanitizeStaticSvg(validSvg('<path d="M200-64L1.5.6"/>')))
  assert.doesNotThrow(() => sanitizeStaticSvg(validSvg('<g transform="translate(4) rotate(45 8 8)"/>')))
})

test('percent lengths carry an explicit magnitude bound', () => {
  // Relative lengths are not naturally bounded (review reproduction).
  reject(validSvg('<rect width="100000000000000000000%" height="100%"/>'), 'exceeds 5000 percent')
  reject(validSvg('<rect width="6000%" height="100%"/>'), 'exceeds 5000 percent')
  reject(validSvg('<rect width="10 %" height="100%"/>'), 'invalid numeric syntax')
  // Bounded relative lengths stay legal.
  assert.doesNotThrow(() => sanitizeStaticSvg(validSvg('<rect width="5000%" height="100%"/>')))
})

test('text positioning lists accept bounded multi-value dx/dy', () => {
  assert.doesNotThrow(() => sanitizeStaticSvg(validSvg('<text x="10 20" y="30" dx="3 3" dy="4 4"><tspan>两列</tspan></text>')))
  reject(validSvg('<text x="10 20 1e7">两列</text>'), 'exceeds 1000000')
})
