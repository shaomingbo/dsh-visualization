import { LIMITS, assertByteLimit } from './limits.ts'
import type { MermaidDiagramHeader } from './types.ts'

/** Lower-cased Markdown fence keys mapped to canonical Mermaid headers. */
export const MERMAID_FENCE_HEADERS: Readonly<Record<string, MermaidDiagramHeader>> = Object.freeze({
  kanban: 'kanban',
  quadrantchart: 'quadrantChart',
  c4context: 'C4Context',
  c4container: 'C4Container',
  c4component: 'C4Component',
  c4dynamic: 'C4Dynamic',
  c4deployment: 'C4Deployment',
  requirementdiagram: 'requirementDiagram',
})

const ALLOWED_HEADERS = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'gitGraph',
  'journey',
  'kanban',
  'quadrantChart',
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
  'requirementDiagram',
] as const

export type AllowedMermaidHeader = typeof ALLOWED_HEADERS[number]

const FORBIDDEN = [
  { pattern: /^\s*---(?:\s|$)/m, reason: 'frontmatter' },
  { pattern: /%%\s*\{/i, reason: 'directives' },
  { pattern: /<\/?[a-z][^>]*>/i, reason: 'HTML labels' },
  { pattern: /\b(?:click|href)\b/i, reason: 'links and callbacks' },
  { pattern: /\b(?:classDef|linkStyle)\b/i, reason: 'style declarations' },
  { pattern: /^\s*style\s+\S+/im, reason: 'style declarations' },
] as const

/** Resolve one normalized Markdown fence language to its canonical Mermaid header. */
export function resolveMermaidFenceHeader(language: string): MermaidDiagramHeader | undefined {
  return MERMAID_FENCE_HEADERS[language.toLowerCase()]
}

/** Detect a supported canonical Mermaid header at the first non-empty line. */
export function detectMermaidHeader(source: string): AllowedMermaidHeader | undefined {
  const first = source.split(/\r?\n/).find(line => line.trim().length > 0)?.trim()
  return first === undefined
    ? undefined
    : ALLOWED_HEADERS.find(candidate => first === candidate || first.startsWith(`${candidate} `))
}

/** Whether a normalized fence should be handled by the Mermaid renderer. */
export function isMermaidFence(language: string, source: string): boolean {
  const normalized = language.toLowerCase()
  return normalized === 'mermaid'
    || resolveMermaidFenceHeader(normalized) !== undefined
    || (normalized === 'text' && detectMermaidHeader(source) !== undefined)
}

/**
 * Build the private render input while leaving displayed/copied source intact.
 * Direct subtype fences gain their canonical header; C4 gets a trusted compact
 * layout default unless the author already supplied one.
 */
export function prepareMermaidSource(source: string, expectedHeader: MermaidDiagramHeader | undefined): string {
  const detected = detectMermaidHeader(source)
  let prepared = source
  if (expectedHeader !== undefined) {
    if (detected === undefined) prepared = `${expectedHeader}\n${source}`
    else if (detected !== expectedHeader) {
      throw new Error(`Mermaid fence expects ${expectedHeader} but source starts with ${detected}`)
    }
  }
  return applyTrustedC4Layout(prepared)
}

function applyTrustedC4Layout(source: string): string {
  const header = detectMermaidHeader(source)
  if (header === undefined || !header.startsWith('C4') || /\bUpdateLayoutConfig\s*\(/i.test(source)) return source
  const lines = source.split(/\r?\n/)
  const headerIndex = lines.findIndex(line => line.trim().length > 0)
  lines.splice(headerIndex + 1, 0, 'UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")')
  return lines.join('\n')
}

/**
 * Validate Mermaid text before the runtime module is imported.
 * @param source - the Mermaid source to validate.
 * @returns the unchanged validated source.
 */
export function validateMermaidSource(source: string): string {
  assertByteLimit(source, LIMITS.sourceBytes, 'Mermaid source')
  const lines = source.split(/\r?\n/)
  if (lines.length > LIMITS.mermaidLines) throw new Error(`Mermaid source exceeds ${LIMITS.mermaidLines} lines`)
  const first = lines.find(line => line.trim().length > 0)?.trim()
  if (first === undefined) throw new Error('Mermaid source is empty')
  const header = ALLOWED_HEADERS.find(candidate => first === candidate || first.startsWith(`${candidate} `))
  if (header === undefined) throw new Error('Mermaid diagram header is not allowed')
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(source)) throw new Error(`Mermaid ${rule.reason} are not allowed`)
  }
  const statements = source.split(/[;\n]/).filter(part => part.trim().length > 0).length
  if (statements > LIMITS.mermaidStatements) {
    throw new Error(`Mermaid source exceeds ${LIMITS.mermaidStatements} statements`)
  }
  const edges = source.match(/-->|---|==>|-.->|--x|--o|<-->|<\|--|--\|>/g)?.length ?? 0
  if (edges > LIMITS.mermaidEdges) throw new Error(`Mermaid source exceeds ${LIMITS.mermaidEdges} edges`)
  return source
}
