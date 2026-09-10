/**
 * Independent security policy for the `dsh-svg` static channel.
 *
 * Unlike the Mermaid/Vega-Lite renderer policies, this gate accepts one
 * complete model-authored SVG document. Defense is layered: explicit input
 * constraints, structural validation of the parsed document, allowlist-driven
 * DOM rewriting, and a re-validation of the serialized output. There is no
 * DOMPurify shortcut here — every element, attribute, and reference below is
 * checked by this module.
 */
import { LIMITS, assertByteLimit } from './limits.ts'

/** Fence language reserved for the static SVG channel. */
export const STATIC_SVG_LANGUAGE = 'dsh-svg'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const ID_PATTERN = /^[A-Za-z_][\w:.-]*$/
/** Any external or resource-bearing scheme rejects the document outright. */
const EXTERNAL_REFERENCE = /(?:https?:|file:|data:|blob:|ftp:|javascript:|\/\/)/i
const LOCAL_URL = /^url\(#([A-Za-z_][\w:.-]*)\)$/

const ALLOWED_ELEMENTS = new Set([
  'svg', 'g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
  'text', 'tspan', 'title', 'desc', 'defs', 'marker',
])

const ALLOWED_ATTRIBUTES = new Set([
  // Structure and accessibility.
  'xmlns', 'version', 'viewbox', 'preserveaspectratio', 'id', 'role',
  'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
  // Geometry.
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'width', 'height', 'pathlength', 'transform',
  // Paint and stroke.
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'opacity',
  // Text.
  'font-family', 'font-size', 'font-style', 'font-weight', 'text-anchor',
  'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'letter-spacing',
  'word-spacing', 'dx', 'dy', 'xml:space',
  // Markers (the only permitted local references).
  'marker-start', 'marker-mid', 'marker-end',
  'markerwidth', 'markerheight', 'markerunits', 'refx', 'refy', 'orient',
])

/** Attributes whose value may be one local `url(#id)` pointing at a marker. */
const MARKER_REFERENCE_ATTRIBUTES = new Set(['marker-start', 'marker-mid', 'marker-end'])
/** Attributes carrying whitespace-separated IDREFs into `title`/`desc`. */
const IDREF_ATTRIBUTES = new Set(['aria-labelledby', 'aria-describedby'])
const TEXT_ELEMENTS = new Set(['text', 'tspan', 'title', 'desc'])

export interface ParsedStaticSvg {
  readonly document: Document
  readonly root: SVGSVGElement
}

/**
 * Whether one normalized fence language routes to the static SVG channel.
 * @param language - normalized Markdown fence language.
 */
export function isStaticSvgFence(language: string): boolean {
  return language.toLowerCase() === STATIC_SVG_LANGUAGE
}

/**
 * One sanitized static SVG document plus its validated accessible name.
 */
export interface SanitizedStaticSvg {
  readonly svg: string
  /** `<title>` text of the validated document, whitespace-normalized. */
  readonly title: string | undefined
}

/**
 * Validate and sanitize one authored `dsh-svg` document into Blob-ready SVG.
 * The size limit is asserted before any XML parsing, so an oversized document
 * never reaches the platform parser. The output re-parses and re-validates
 * before returning, so the returned string satisfies the same allowlist it was
 * produced from. The accessible title is read from the validated document, so
 * callers never need to parse raw, unvalidated source for naming.
 * @param source - raw fence body.
 * @returns the sanitized, serialized SVG document and its title.
 */
export function sanitizeStaticSvgDocument(source: string): SanitizedStaticSvg {
  assertByteLimit(source, LIMITS.staticSvgSourceBytes, 'dsh-svg source')
  const parsed = parseStaticSvg(source)
  validateStructure(parsed)
  const title = validatedTitle(parsed.root)
  const ids = collectIds(parsed)
  const prefix = `dsh-svg-${++prefixSequence}-`
  rewriteIds(parsed, ids, prefix)
  const serialized = serialize(parsed.root)
  // Output check: the serialized document must survive the same policy.
  const reparsed = parseStaticSvg(serialized)
  validateStructure(reparsed)
  validateReferences(reparsed, collectIds(reparsed))
  assertByteLimit(serialized, LIMITS.svgBytes, 'Sanitized dsh-svg output')
  return { svg: serialized, title }
}

/**
 * Validate and sanitize one authored `dsh-svg` document into Blob-ready SVG.
 * @param source - raw fence body.
 * @returns the sanitized, serialized SVG document.
 */
export function sanitizeStaticSvg(source: string): string {
  return sanitizeStaticSvgDocument(source).svg
}

/**
 * Read the accessible name from an already validated document. Structural
 * validation guarantees exactly one non-empty `<title>` as the first child,
 * so this only normalizes its text.
 */
function validatedTitle(root: SVGSVGElement): string | undefined {
  const title = [...root.children].find(child => child.localName.toLowerCase() === 'title')
  const text = title?.textContent?.replace(/\s+/g, ' ').trim()
  return text !== undefined && text.length > 0 ? text : undefined
}

/**
 * Serialize one element as XML. Browsers use the platform XMLSerializer; the
 * test DOM shim exposes the equivalent through `Element.toString()`.
 */
function serializeElement(root: Element): string {
  const serializer = (globalThis as { XMLSerializer?: new () => { serializeToString(node: unknown): string } }).XMLSerializer
  if (serializer !== undefined) return new serializer().serializeToString(root)
  return root.toString()
}

function parseXml(source: string): Document {
  return new DOMParser().parseFromString(source, 'image/svg+xml')
}

function isParseError(document: Document): boolean {
  return document.querySelector('parsererror') !== null || document.documentElement === null
}

function parseStaticSvg(source: string): ParsedStaticSvg {
  const document = parseXml(source)
  if (isParseError(document)) {
    throw new Error('dsh-svg source is not well-formed XML')
  }
  if (document.doctype !== null) throw new Error('dsh-svg DOCTYPE and entity declarations are not allowed')
  const root = document.documentElement
  if (root.localName !== 'svg') throw new Error('dsh-svg requires exactly one svg root element')
  // Compared as an attribute so the check behaves identically on strict XML
  // parsers and test DOM shims; namespace-declared prefixes stay rejected by
  // the attribute allowlist below.
  const xmlns = root.getAttribute('xmlns')
  if (xmlns !== SVG_NAMESPACE) throw new Error('dsh-svg namespace must be the SVG namespace')
  return { document, root: root as unknown as SVGSVGElement }
}

/** Comment and processing-instruction node types (avoiding a `Node` global dependency). */
const COMMENT_NODE = 8
const PROCESSING_INSTRUCTION_NODE = 7

/** Iterate every DOM node in the document, including the root itself. */
function* walkNodes(document: Document): Generator<Node> {
  for (const child of document.childNodes) {
    yield child
    yield* walkSubtree(child)
  }
}

function* walkSubtree(node: Node): Generator<Node> {
  for (const child of node.childNodes) {
    yield child
    yield* walkSubtree(child)
  }
}

function validateStructure(parsed: ParsedStaticSvg): void {
  const { document, root } = parsed
  // Comments and processing instructions are rejected wherever they appear.
  for (const node of walkNodes(document)) {
    if (node.nodeType === COMMENT_NODE || node.nodeType === PROCESSING_INSTRUCTION_NODE) {
      throw new Error('dsh-svg comments and processing instructions are not allowed')
    }
  }
  const elements = [root, ...root.querySelectorAll('*')]
  if (elements.length > LIMITS.svgElements) throw new Error(`dsh-svg exceeds ${LIMITS.svgElements} elements`)
  const serializedText = serializeElement(root)
  if (/<!(?:DOCTYPE|ENTITY)/i.test(serializedText)) {
    throw new Error('dsh-svg DOCTYPE and entity declarations are not allowed')
  }
  validateViewBox(root)
  validateRootSize(root)
  validateTitleAndDesc(root)
  let depthSeen = 0
  for (const element of elements) {
    depthSeen = Math.max(depthSeen, elementDepth(root, element))
    const tag = element.localName.toLowerCase()
    if (!ALLOWED_ELEMENTS.has(tag)) throw new Error(`dsh-svg element <${element.localName}> is not allowed`)
    if (element.attributes.length > LIMITS.svgAttributes) {
      throw new Error(`dsh-svg element exceeds ${LIMITS.svgAttributes} attributes`)
    }
    for (const attribute of [...element.attributes]) {
      validateAttribute(attribute.name, attribute.value)
    }
    if (TEXT_ELEMENTS.has(tag)) {
      assertByteLimit(element.textContent ?? '', LIMITS.staticSvgTextBytes, `dsh-svg <${tag}> text`)
    }
  }
  if (depthSeen > LIMITS.staticSvgDepth) throw new Error(`dsh-svg nesting exceeds ${LIMITS.staticSvgDepth} levels`)
}

function elementDepth(root: Element, element: Element): number {
  let depth = 0
  for (let node: Element | null = element; node !== null && node !== root.parentElement; node = node.parentElement) depth += 1
  return depth
}

function validateAttribute(name: string, value: string): void {
  const normalized = name.toLowerCase()
  if (normalized.startsWith('on')) throw new Error(`dsh-svg event attribute ${name} is not allowed`)
  if (!ALLOWED_ATTRIBUTES.has(normalized)) throw new Error(`dsh-svg attribute ${name} is not allowed`)
  if (normalized === 'xmlns') {
    // The required namespace declaration is not a resource reference.
    if (value !== SVG_NAMESPACE) throw new Error('dsh-svg namespace is not allowed')
    return
  }
  if (value.includes('\\')) {
    // CSS/unicode escape sequences can disguise protocols and url() tokens
    // from the checks below (e.g. `u\72l('https:…')`). Authored diagrams have
    // no legitimate use for backslashes in attribute values, so they are
    // rejected outright instead of trying to normalize every escape grammar.
    throw new Error(`dsh-svg attribute ${name} must not contain escape sequences`)
  }
  if (EXTERNAL_REFERENCE.test(value)) throw new Error('dsh-svg external references are not allowed')
  if (value.length > LIMITS.stringBytes) throw new Error(`dsh-svg attribute ${name} exceeds ${LIMITS.stringBytes} bytes`)
  if (normalized === 'version' && value !== '1.1') throw new Error('dsh-svg version is not allowed')
  if (/url\s*\(/i.test(value) && !(MARKER_REFERENCE_ATTRIBUTES.has(normalized) && LOCAL_URL.test(value.trim()))) {
    throw new Error('dsh-svg only local marker url(#id) references are allowed')
  }
  if (NUMERIC_VALUE_ATTRIBUTES.has(normalized)) validateNumericValue(normalized, value)
}

/** Attributes whose whole value must be sane bounded numbers. */
const NUMERIC_VALUE_ATTRIBUTES = new Set([
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'dx', 'dy',
  'width', 'height', 'pathlength', 'd', 'points', 'transform',
])

/** Attributes parsed as exactly one bounded SVG number. */
const SINGLE_NUMBER_ATTRIBUTES = new Set([
  'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'pathlength',
])
/** Attributes parsed as a bounded number sequence (text positioning lists). */
const NUMBER_LIST_ATTRIBUTES = new Set(['x', 'y', 'dx', 'dy'])

/** Strict SVG number grammar (no hex; `1.` mantissa allowed; full exponent). */
const SVG_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/
const SVG_NUMBER_SOURCE = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?'
/** Sticky scanner for one number at the current cursor position. */
const NUMBER_AT = new RegExp(SVG_NUMBER_SOURCE, 'y')
/** Sticky scanner for one transform function identifier. */
const IDENTIFIER_AT = /[A-Za-z]+/y
/** Path data command letters (SVG path grammar). */
const PATH_COMMAND_CHARS = 'MmLlHhVvCcSsQqTtAaZz'
const TRANSFORM_FUNCTIONS = new Set(['translate', 'scale', 'rotate', 'skewx', 'skewy', 'matrix'])

/**
 * Cursor that fully consumes one attribute value as SVG numbers. Every numeric
 * token is read as a complete grammar unit — a partial extraction would split
 * `1.e100` into `1` and `100` and lose the magnitude — and any unconsumed
 * character is a syntax error.
 */
class NumberCursor {
  private readonly name: string
  private readonly value: string
  private position = 0

  constructor(name: string, value: string) {
    this.name = name
    this.value = value
  }

  atEnd(): boolean {
    return this.position >= this.value.length
  }

  peek(): string | undefined {
    return this.value[this.position]
  }

  skipSeparators(): void {
    while (this.position < this.value.length && /[\s,]/.test(this.value[this.position]!)) this.position += 1
  }

  skipSpace(): void {
    while (this.position < this.value.length && /\s/.test(this.value[this.position]!)) this.position += 1
  }

  /** Consume one path command letter, or return `null`. */
  readCommand(): string | null {
    const char = this.value[this.position]
    if (char === undefined || !PATH_COMMAND_CHARS.includes(char)) return null
    this.position += 1
    return char
  }

  /** Consume one transform function identifier (`[A-Za-z]+`). */
  readIdentifier(): string {
    IDENTIFIER_AT.lastIndex = this.position
    const match = IDENTIFIER_AT.exec(this.value)
    if (match === null || match.index !== this.position) {
      throw new Error(`dsh-svg attribute ${this.name} has invalid numeric syntax`)
    }
    this.position = IDENTIFIER_AT.lastIndex
    return match[0]
  }

  /** Consume one complete SVG number; any other character is a syntax error. */
  readNumber(): string {
    NUMBER_AT.lastIndex = this.position
    const match = NUMBER_AT.exec(this.value)
    if (match === null || match.index !== this.position) {
      throw new Error(`dsh-svg attribute ${this.name} has invalid numeric syntax`)
    }
    this.position = NUMBER_AT.lastIndex
    return match[0]
  }

  expect(char: string): void {
    if (this.value[this.position] !== char) {
      throw new Error(`dsh-svg attribute ${this.name} has invalid numeric syntax`)
    }
    this.position += 1
  }
}

function checkNumber(name: string, token: string): void {
  const numeric = Number(token)
  if (!Number.isFinite(numeric)) throw new Error(`dsh-svg attribute ${name} has invalid numeric syntax`)
  if (Math.abs(numeric) > LIMITS.staticSvgCoord) {
    throw new Error(`dsh-svg attribute ${name} exceeds ${LIMITS.staticSvgCoord} units`)
  }
}

/** One bounded SVG number sequence with full coverage (empty lists are valid). */
function validateNumberSequence(name: string, value: string): void {
  const cursor = new NumberCursor(name, value)
  while (!cursor.atEnd()) {
    cursor.skipSeparators()
    if (cursor.atEnd()) break
    checkNumber(name, cursor.readNumber())
  }
}

/** Path data: command letters and bounded numbers, fully consumed. */
function validatePathData(name: string, value: string): void {
  const cursor = new NumberCursor(name, value)
  while (!cursor.atEnd()) {
    cursor.skipSeparators()
    if (cursor.atEnd()) break
    if (cursor.readCommand() !== null) continue
    checkNumber(name, cursor.readNumber())
  }
}

/**
 * Transform list: `translate|scale|rotate|skewX|skewY|matrix` around bounded
 * number arguments, fully consumed. Unknown function names, empty argument
 * lists, and unbalanced parens are syntax errors.
 */
function validateTransformList(name: string, value: string): void {
  const cursor = new NumberCursor(name, value)
  let functions = 0
  while (!cursor.atEnd()) {
    cursor.skipSeparators()
    if (cursor.atEnd()) break
    if (!TRANSFORM_FUNCTIONS.has(cursor.readIdentifier().toLowerCase())) {
      throw new Error(`dsh-svg attribute ${name} has invalid numeric syntax`)
    }
    cursor.skipSpace()
    cursor.expect('(')
    let argumentsSeen = 0
    for (;;) {
      cursor.skipSeparators()
      if (cursor.peek() === ')') break
      if (cursor.atEnd()) throw new Error(`dsh-svg attribute ${name} has invalid numeric syntax`)
      checkNumber(name, cursor.readNumber())
      argumentsSeen += 1
    }
    if (argumentsSeen === 0) throw new Error(`dsh-svg attribute ${name} has invalid numeric syntax`)
    cursor.expect(')')
    functions += 1
  }
  if (functions === 0) throw new Error(`dsh-svg attribute ${name} has invalid numeric syntax`)
}

function validateNumericValue(name: string, value: string): void {
  const trimmed = value.trim()
  if (trimmed.endsWith('%')) {
    // Percent lengths are viewport-relative, not naturally bounded: the number
    // carries an explicit percent bound (see LIMITS.staticSvgPercent).
    const number = trimmed.slice(0, -1)
    if (!SVG_NUMBER.test(number)) throw new Error(`dsh-svg attribute ${name} has invalid numeric syntax`)
    if (Math.abs(Number(number)) > LIMITS.staticSvgPercent) {
      throw new Error(`dsh-svg attribute ${name} exceeds ${LIMITS.staticSvgPercent} percent`)
    }
    return
  }
  if (name === 'transform') {
    validateTransformList(name, trimmed)
    return
  }
  if (name === 'd') {
    validatePathData(name, trimmed)
    return
  }
  if (name === 'points' || NUMBER_LIST_ATTRIBUTES.has(name)) {
    validateNumberSequence(name, trimmed)
    return
  }
  // The remaining numeric attributes are exactly one bounded SVG number.
  if (!SVG_NUMBER.test(trimmed)) throw new Error(`dsh-svg attribute ${name} has invalid numeric syntax`)
  checkNumber(name, trimmed)
}

function validateViewBox(root: SVGSVGElement): void {
  const raw = root.getAttribute('viewBox')
  if (raw === null) throw new Error('dsh-svg requires a viewBox attribute')
  const parts = raw.trim().split(/[\s,]+/)
  if (parts.length !== 4 || !parts.every(part => SVG_NUMBER.test(part))) {
    throw new Error('dsh-svg viewBox must contain four decimal SVG numbers')
  }
  const [x, y, width, height] = parts.map(Number)
  if (width! <= 0 || height! <= 0) throw new Error('dsh-svg viewBox width and height must be positive')
  for (const value of [x!, y!, width!, height!]) {
    if (Math.abs(value) > LIMITS.staticSvgExtent) throw new Error(`dsh-svg viewBox exceeds ${LIMITS.staticSvgExtent} units`)
  }
}

/** The canvas is the viewBox plus any authored root width/height. */
function validateRootSize(root: SVGSVGElement): void {
  for (const name of ['width', 'height']) {
    const raw = root.getAttribute(name)
    if (raw === null) continue
    const value = raw.trim()
    if (!SVG_NUMBER.test(value)) throw new Error(`dsh-svg root ${name} must be a plain decimal number`)
    const numeric = Number(value)
    if (numeric <= 0) throw new Error(`dsh-svg root ${name} must be positive`)
    if (numeric > LIMITS.staticSvgExtent) throw new Error(`dsh-svg root ${name} exceeds ${LIMITS.staticSvgExtent} units`)
  }
}

function validateTitleAndDesc(root: SVGSVGElement): void {
  const children = [...root.children]
  const titles = children.filter(child => child.localName.toLowerCase() === 'title')
  const descriptions = children.filter(child => child.localName.toLowerCase() === 'desc')
  if (titles.length !== 1 || children[0] !== titles[0]) {
    throw new Error('dsh-svg requires exactly one <title> as the first child of <svg>')
  }
  if (descriptions.length !== 1) throw new Error('dsh-svg requires exactly one <desc> element')
  for (const node of [titles[0]!, descriptions[0]!]) {
    if ((node.textContent ?? '').trim().length === 0) throw new Error('dsh-svg <title> and <desc> must contain text')
  }
}

function collectIds(parsed: ParsedStaticSvg): ReadonlyMap<string, Element> {
  const ids = new Map<string, Element>()
  for (const element of [parsed.root, ...parsed.root.querySelectorAll('*')]) {
    const id = element.getAttribute('id')
    if (id === null) continue
    if (!ID_PATTERN.test(id)) throw new Error(`dsh-svg id "${id}" is not a valid local id`)
    if (ids.has(id)) throw new Error(`dsh-svg contains duplicate id "${id}"`)
    ids.set(id, element)
  }
  return ids
}

function validateReferences(parsed: ParsedStaticSvg, ids: ReadonlyMap<string, Element>): void {
  for (const element of [parsed.root, ...parsed.root.querySelectorAll('*')]) {
    for (const name of MARKER_REFERENCE_ATTRIBUTES) {
      const value = element.getAttribute(name)
      if (value === null) continue
      const match = LOCAL_URL.exec(value.trim())
      const target = match === null ? undefined : ids.get(match[1]!)
      if (target === undefined || target.localName.toLowerCase() !== 'marker') {
        throw new Error(`dsh-svg ${name} must reference a local <marker> id`)
      }
    }
    for (const name of IDREF_ATTRIBUTES) {
      const value = element.getAttribute(name)
      if (value === null) continue
      for (const ref of value.trim().split(/\s+/)) {
        if (!ids.has(ref)) throw new Error(`dsh-svg ${name} references missing id "${ref}"`)
      }
    }
  }
}

function rewriteIds(parsed: ParsedStaticSvg, ids: ReadonlyMap<string, Element>, prefix: string): void {
  const renamed = new Map<string, string>()
  for (const [id] of ids) renamed.set(id, `${prefix}${id}`)
  for (const element of [parsed.root, ...parsed.root.querySelectorAll('*')]) {
    const id = element.getAttribute('id')
    if (id !== null) element.setAttribute('id', renamed.get(id) ?? id)
    for (const name of MARKER_REFERENCE_ATTRIBUTES) {
      const value = element.getAttribute(name)
      if (value === null) continue
      // Validation trims, so rewriting also normalizes the padded form;
      // otherwise `marker-end=" url(#a) "` would keep a stale reference.
      element.setAttribute(name, value.trim().replace(LOCAL_URL, (_match, oldId: string) => `url(#${renamed.get(oldId) ?? oldId})`))
    }
    for (const name of IDREF_ATTRIBUTES) {
      const value = element.getAttribute(name)
      if (value === null) continue
      element.setAttribute(name, value.trim().split(/\s+/).map(ref => renamed.get(ref) ?? ref).join(' '))
    }
  }
  // Referential integrity is judged on the rewritten document: a dangling
  // authored reference keeps its un-renamed target and fails the lookup.
  validateReferences(parsed, collectIds(parsed))
}

function serialize(root: SVGSVGElement): string {
  const serialized = serializeElement(root)
  if (serialized.includes('<!DOCTYPE') || serialized.includes('<!ENTITY')) {
    throw new Error('dsh-svg DOCTYPE and entity declarations are not allowed')
  }
  return serialized
}

let prefixSequence = 0
