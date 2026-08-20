import DOMPurify from 'dompurify'
import * as csstree from 'css-tree/dist/csstree.esm'
import { compactC4PersonTextY } from './c4-layout.ts'
import { LIMITS, assertByteLimit } from './limits.ts'

/** Renderer whose SVG policy is applied during sanitization. */
export type VisualizationRenderer = 'mermaid' | 'vega-lite'

const COMMON_TAGS = new Set([
  'svg', 'g', 'defs', 'title', 'desc', 'metadata', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textpath', 'marker', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern',
  'symbol', 'switch',
])
const MERMAID_TAGS = new Set([
  ...COMMON_TAGS,
  'style',
  'filter',
  'feblend',
  'fecolormatrix',
  'fecomponenttransfer',
  'fecomposite',
  'feconvolvematrix',
  'fediffuselighting',
  'fedisplacementmap',
  'fedistantlight',
  'fedropshadow',
  'feflood',
  'fefunca',
  'fefuncb',
  'fefuncg',
  'fefuncr',
  'fegaussianblur',
  'femerge',
  'femergenode',
  'femorphology',
  'feoffset',
  'fepointlight',
  'fespecularlighting',
  'fespotlight',
  'fetile',
  'feturbulence',
])
const VEGA_TAGS = COMMON_TAGS
const FORBIDDEN_TAGS = new Set([
  'script', 'foreignobject', 'image', 'a', 'use', 'animate', 'animatemotion', 'animatetransform', 'set', 'audio', 'video', 'iframe',
])
const ALLOWED_ATTRIBUTES = new Set([
  'xmlns', 'xmlns:xlink', 'version', 'id', 'class', 'role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-roledescription', 'aria-hidden', 'viewBox', 'width', 'height',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'opacity', 'display', 'visibility',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'clip-path', 'clip-rule', 'mask', 'filter', 'marker-start',
  'marker-mid', 'marker-end', 'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'orient', 'viewbox',
  'gradientUnits', 'gradientTransform', 'spreadMethod', 'offset', 'stop-color', 'stop-opacity', 'patternUnits',
  'patternContentUnits', 'patternTransform', 'preserveAspectRatio', 'font-family', 'font-size', 'font-style', 'font-weight',
  'text-anchor', 'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'direction', 'unicode-bidi', 'letter-spacing',
  'word-spacing', 'text-decoration', 'paint-order', 'pointer-events', 'vector-effect', 'pathLength', 'startOffset', 'method', 'spacing',
  'lengthAdjust', 'textLength', 'xml:space', 'style', 'shape-rendering', 'text-rendering', 'color-interpolation-filters',
  'dx', 'dy', 'tabindex', 'target', 'download', 'clip', 'overflow', 'white-space',
  'transform-origin', 'name', 'lang', 'xml:lang', 'focusable', 'xlink:title',
  'writing-mode', 'glyph-orientation-vertical', 'glyph-orientation-horizontal',
  'kerning', 'color', 'color-interpolation', 'isolation', 'mix-blend-mode',
  'in', 'in2', 'result', 'stdDeviation', 'type', 'slope', 'intercept', 'amplitude', 'exponent', 'offset',
  'values', 'mode', 'operator', 'k1', 'k2', 'k3', 'k4', 'order', 'kernelMatrix', 'divisor', 'bias',
  'targetX', 'targetY', 'edgeMode', 'kernelUnitLength', 'preserveAlpha', 'surfaceScale', 'diffuseConstant',
  'specularConstant', 'specularExponent', 'limitingConeAngle', 'pointsAtX', 'pointsAtY', 'pointsAtZ',
  'azimuth', 'elevation', 'flood-color', 'flood-opacity', 'lighting-color', 'baseFrequency', 'numOctaves',
  'seed', 'stitchTiles', 'scale', 'xChannelSelector', 'yChannelSelector', 'radius', 'stdDeviation',
].map(name => name.toLowerCase()))
const URI_ATTRIBUTES = new Set(['href', 'xlink:href', 'src'])
const LOCAL_REFERENCE_ATTRIBUTES = new Set([
  'fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end',
])
const FORBIDDEN_CSS_PROPERTIES = new Set([
  'behavior', 'binding', 'content', 'src', 'srcset', '-moz-binding',
])
const ALLOWED_CSS_AT_RULES = new Set(['keyframes', 'media'])
let prefixSequence = 0

/**
 * Sanitize renderer output for Blob serialization.
 * @param svg - the renderer-produced SVG source.
 * @param renderer - the policy associated with the renderer.
 * @returns the sanitized SVG eligible for Blob serialization.
 */
export function sanitizeVisualizationSvg(svg: string, renderer: VisualizationRenderer): string {
  assertByteLimit(svg, LIMITS.svgBytes, 'SVG output')
  const prepared = renderer === 'mermaid'
    ? stripMermaidImages(flattenMermaidForeignObjects(svg))
    : svg
  preflightSvg(prepared, renderer)
  const clean = DOMPurify.sanitize(prepared, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: renderer === 'mermaid' ? ['style'] : [],
    FORBID_TAGS: [...FORBIDDEN_TAGS],
    FORBID_ATTR: ['href', 'xlink:href', 'src'],
  })
  const document = new DOMParser().parseFromString(clean, 'image/svg+xml')
  if (document.querySelector('parsererror') !== null || document.documentElement.localName !== 'svg') {
    throw new Error('Renderer did not produce one valid SVG root')
  }
  const root = document.documentElement
  const allowed = renderer === 'mermaid' ? MERMAID_TAGS : VEGA_TAGS
  const elements = [root, ...root.querySelectorAll('*')]
  if (elements.length > LIMITS.svgElements) throw new Error(`SVG exceeds ${LIMITS.svgElements} elements`)
  const prefix = `dsh-viz-${++prefixSequence}-`
  const ids = new Map<string, string>()

  for (const element of elements) {
    const tag = element.localName.toLowerCase()
    if (!allowed.has(tag) || FORBIDDEN_TAGS.has(tag)) {
      throw new Error(`SVG element <${element.localName}> is not allowed`)
    }
    if (element.attributes.length > LIMITS.svgAttributes) {
      throw new Error(`SVG element exceeds ${LIMITS.svgAttributes} attributes`)
    }
    const id = element.getAttribute('id')
    if (id !== null && !ids.has(id)) ids.set(id, `${prefix}${id}`)
  }

  for (const element of elements) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on') || URI_ATTRIBUTES.has(name) || (!ALLOWED_ATTRIBUTES.has(name) && !name.startsWith('data-'))) throw new Error(`SVG attribute ${name} is not allowed`)
      if (/url\s*\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) {
        throw new Error('SVG external references are not allowed')
      }
      if (LOCAL_REFERENCE_ATTRIBUTES.has(name) && /(?:https?:|file:|data:|blob:|\/\/)/i.test(value)) {
        throw new Error('SVG external references are not allowed')
      }
      if (name === 'style') {
        if (renderer !== 'mermaid') throw new Error('Vega SVG style attributes are not allowed')
        element.setAttribute('style', sanitizeDeclarationList(value, ids))
      }
    }
    const id = element.getAttribute('id')
    if (id !== null) element.setAttribute('id', ids.get(id) ?? id)
    for (const name of LOCAL_REFERENCE_ATTRIBUTES) {
      const value = element.getAttribute(name)
      if (value !== null) element.setAttribute(name, rewriteLocalReferences(value, ids))
    }
  }

  for (const style of root.querySelectorAll('style')) {
    if (renderer !== 'mermaid') throw new Error('Vega SVG style elements are not allowed')
    style.textContent = sanitizeStylesheet(style.textContent, ids)
  }
  const serialized = new XMLSerializer().serializeToString(root)
  assertByteLimit(serialized, LIMITS.svgBytes, 'Sanitized SVG output')
  return serialized
}

function preflightSvg(svg: string, renderer: VisualizationRenderer): void {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (document.querySelector('parsererror') !== null || document.documentElement.localName !== 'svg') {
    throw new Error('Renderer did not produce one valid SVG root')
  }
  const elements = [document.documentElement, ...document.documentElement.querySelectorAll('*')]
  if (elements.length > LIMITS.svgElements) throw new Error(`SVG exceeds ${LIMITS.svgElements} elements`)
  const allowed = renderer === 'mermaid' ? MERMAID_TAGS : VEGA_TAGS
  for (const element of elements) {
    const tag = element.localName.toLowerCase()
    if (!allowed.has(tag) || FORBIDDEN_TAGS.has(tag)) throw new Error(`SVG element <${element.localName}> is not allowed`)
    if (renderer === 'vega-lite' && tag === 'style') throw new Error('Vega SVG style elements are not allowed')
    if (element.attributes.length > LIMITS.svgAttributes) throw new Error(`SVG element exceeds ${LIMITS.svgAttributes} attributes`)
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value
      if (name.startsWith('on') || URI_ATTRIBUTES.has(name) || (!ALLOWED_ATTRIBUTES.has(name) && !name.startsWith('data-'))) throw new Error(`SVG attribute ${name} is not allowed`)
      if (name === 'xmlns' && value !== 'http://www.w3.org/2000/svg') throw new Error('SVG namespace is not allowed')
      if (name === 'xmlns:xlink' && value !== 'http://www.w3.org/1999/xlink') throw new Error('SVG XLink namespace is not allowed')
      if (name === 'version' && value !== '1.1') throw new Error('SVG version is not allowed')
      if (name === 'pointer-events' && value !== 'none') throw new Error('SVG pointer behavior is not allowed')
      if (renderer === 'vega-lite' && name === 'style') throw new Error('Vega SVG style attributes are not allowed')
      if ((!name.startsWith('xmlns') && /(?:https?:|file:|data:|blob:|\/\/)/i.test(value)) || (/url\s*\(/i.test(value) && !/url\(#[^)]+\)/i.test(value))) {
        throw new Error('SVG external references are not allowed')
      }
    }
  }
}

function rewriteLocalReferences(value: string, ids: ReadonlyMap<string, string>): string {
  return value.replace(/url\(#([A-Za-z_][\w:.-]*)\)/g, (_match, oldId: string) => {
    const replacement = ids.get(oldId)
    if (replacement === undefined) throw new Error('SVG references a missing local id')
    return `url(#${replacement})`
  })
}

function sanitizeDeclarationList(css: string, ids: ReadonlyMap<string, string>): string {
  const ast = csstree.parse(css, { context: 'declarationList' })
  validateCssAst(ast, ids)
  return rewriteLocalCssUrls(csstree.generate(ast), ids)
}

function sanitizeStylesheet(css: string, ids: ReadonlyMap<string, string>): string {
  assertByteLimit(css, LIMITS.sourceBytes, 'Mermaid CSS')
  const ast = csstree.parse(css, { context: 'stylesheet' })
  validateCssAst(ast, ids)
  return rewriteLocalCssUrls(csstree.generate(ast), ids)
}

function rewriteLocalCssUrls(css: string, ids: ReadonlyMap<string, string>): string {
  return css.replace(/url\(#([A-Za-z_][\w:.-]*)\)/g, (match, oldId: string) => {
    const replacement = ids.get(oldId)
    // A local id not in the SVG element map (e.g. DOMPurify removed the
    // gradient definition) is a stale reference, not a security risk; leave
    // it as-is so the browser ignores the broken reference silently.
    return replacement === undefined ? match : `url(#${replacement})`
  })
}

function validateCssAst(ast: unknown, ids: ReadonlyMap<string, string>): void {
  csstree.walk(ast, (node) => {
    if (!isCssNode(node)) throw new Error('Mermaid CSS contains an invalid AST node')
    if (node.type === 'Url') {
      const inner = typeof node.value === 'string' ? node.value : undefined
      if (typeof inner !== 'string' || !/^#[A-Za-z_][\w:.-]*$/.test(inner)) {
        throw new Error('Mermaid CSS external or at-rules are not allowed')
      }
      // Defer rewrite to post-generate string replacement; mutating node.value
      // inside walk crashes css-tree's List reducer (it re-walks the new value).
    }
    if (node.type === 'Atrule') {
      const name = typeof node.name === 'string' ? node.name.toLowerCase() : ''
      if (!ALLOWED_CSS_AT_RULES.has(name)) throw new Error('Mermaid CSS external or at-rules are not allowed')
    }
    if (node.type === 'Declaration') {
      if (typeof node.property !== 'string' || FORBIDDEN_CSS_PROPERTIES.has(node.property.toLowerCase()) || (node.property.startsWith('--') && !node.property.toLowerCase().startsWith('--mermaid-'))) {
        throw new Error(`Mermaid CSS property ${String(node.property)} is not allowed`)
      }
      const value = csstree.generate(node.value)
      if (/expression\s*\(|(?:https?:|file:|data:|blob:|\/\/)/i.test(value)) {
        throw new Error('Mermaid CSS executable or external values are not allowed')
      }
    }
    if (node.type === 'IdSelector') {
      if (typeof node.name !== 'string') throw new Error('Mermaid CSS contains an invalid id selector')
      const replacement = ids.get(node.name)
      if (replacement === undefined) throw new Error('Mermaid CSS references a missing local id')
      node.name = replacement
    }
  })
}

function isCssNode(value: unknown): value is { type: string; property?: unknown; value?: unknown; name?: unknown } {
  return value !== null && typeof value === 'object' && 'type' in value && typeof value.type === 'string'
}

/** Replace Mermaid HTML labels with inert SVG text so journey/mindmap stay renderable. */
function flattenMermaidForeignObjects(svg: string): string {
  return svg.replace(/<foreignObject\b([^>]*)>([\s\S]*?)<\/foreignObject>/gi, (_match, rawAttrs: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const attrs = ['x', 'y', 'width', 'height']
      .map((name) => {
        const value = new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(rawAttrs)?.[1]
        return value === undefined ? '' : ` ${name}="${value}"`
      })
      .join('')
    return `<text${attrs}>${escapeXml(text)}</text>`
  })
}

/** Remove C4 icon images and collapse the person label slot they occupied. */
function stripMermaidImages(svg: string): string {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (document.querySelector('parsererror') !== null) return svg
  for (const image of document.querySelectorAll('image')) {
    let group: Element | null = image.parentElement
    while (group !== null && !(group.localName === 'g' && group.classList.contains('person-man'))) {
      group = group.parentElement
    }
    if (group !== null) {
      const imageY = Number.parseFloat(image.getAttribute('y') ?? '')
      const imageHeight = Number.parseFloat(image.getAttribute('height') ?? '')
      for (const text of group.querySelectorAll('text[y]')) {
        const textY = Number.parseFloat(text.getAttribute('y') ?? '')
        const compactY = compactC4PersonTextY(textY, imageY, imageHeight)
        if (compactY !== textY) text.setAttribute('y', String(compactY))
      }
    }
    image.remove()
  }
  return new XMLSerializer().serializeToString(document.documentElement)
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
