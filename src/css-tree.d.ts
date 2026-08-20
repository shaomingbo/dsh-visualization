declare module 'css-tree/dist/csstree.esm' {
  export interface ParseOptions {
    readonly context?: 'declarationList' | 'stylesheet'
  }

  export function parse(source: string, options?: ParseOptions): unknown
  export function generate(node: unknown): string
  export function walk(node: unknown, callback: (node: unknown) => void): void
}
