/**
 * Rebuild the committed `lib/` artifacts from `src/`.
 *
 * The client artifact keeps the Host wire format: a CJS bundle executed inside
 * `window.__ModuleLoader__.load({ id, factory })`, with Host platform modules
 * (React and DSH client UI primitives) left external so the Host module table
 * supplies them. The Vega worker stays a self-contained classic script with no
 * imports. Node halves are plain ESM. CSS modules compile to inline JS strings
 * with lightningcss so the bundle ships one self-contained file.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { rolldown } from 'rolldown'
import { transform as lightningTransform } from 'lightningcss'

const root = new URL('..', import.meta.url)
const EXTERNAL_PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/dsh-client-ui-primitives',
]
const EXTERNAL_NODE_BUILTINS = /^node:/

/** Transform options shared by every bundle: automatic JSX runtime for .tsx sources. */
const TRANSFORM = { jsx: 'react-jsx' }

/** Compile one CSS module into a JS module that registers its own idempotent <style> tag. */
function cssModulesPlugin() {
  return {
    name: 'dsh-visualization-css-modules',
    // `load` (not `transform`) so the .module.css module never reaches the
    // bundler's removed CSS pipeline; the module is handed over as JS.
    async load(id) {
      if (!id.endsWith('.module.css')) return null
      const code = await readFile(id, 'utf8')
      const result = lightningTransform({
        filename: id,
        code: Buffer.from(code),
        cssModules: true,
        errorRecovery: false,
      })
      const names = result.exports ?? {}
      const entries = Object.entries(names).map(([name, value]) => [name, value.name])
      const objectLiteral = `{\n${entries.map(([name, value]) => `  ${JSON.stringify(name)}: ${JSON.stringify(value)}`).join(',\n')}\n}`
      const tagId = `dsh-visualization/${id.split('/').pop()}`
      return {
        moduleType: 'js',
        code: [
          `const css = ${JSON.stringify(result.code.toString())};`,
          `const names = ${objectLiteral};`,
          `const tagId = ${JSON.stringify(tagId)};`,
          'if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {',
          '\tconst tag = document.createElement("style");',
          '\ttag.dataset.plugin = "dsh-visualization";',
          '\ttag.dataset.pluginCss = tagId;',
          '\ttag.textContent = css;',
          '\tdocument.head.appendChild(tag);',
          '}',
          'export default names;',
          'export { names as cssModules, css as cssText };',
        ].join('\n'),
        map: null,
      }
    },
  }
}

async function buildClient() {
  const bundle = await rolldown({
    input: fileURL('src/client/index.ts'),
    external: EXTERNAL_PLATFORM_MODULES,
    plugins: [cssModulesPlugin()],
    transform: TRANSFORM,
  })
  const { output } = await bundle.generate({
    format: 'cjs',
    exports: 'named',
    strict: false,
    inlineDynamicImports: true,
  })
  const body = output.find(chunk => chunk.isEntry)?.code
  if (typeof body !== 'string') throw new Error('client bundle entry missing')
  await bundle.close()
  const wrapped = [
    'window.__ModuleLoader__.load({',
    '\tid: "dsh-visualization",',
    '\tfactory: (require) => {',
    '\t\tvar module = { exports: {} };',
    '\t\tvar exports = module.exports;',
    // Trailing whitespace is stripped so `git diff --check` stays clean on the
    // committed artifact.
    ...body.split('\n').map(line => {
      const trimmed = line.replace(/[ \t]+$/, '')
      return trimmed.length > 0 ? `\t\t${trimmed}` : trimmed
    }),
    '\t\treturn module.exports;',
    '\t}',
    '});',
    '',
  ].join('\n')
  return wrapped
}

async function buildWorker() {
  const bundle = await rolldown({
    input: fileURL('src/vega-lite.worker.ts'),
    transform: TRANSFORM,
  })
  const { output } = await bundle.generate({ format: 'iife', inlineDynamicImports: true })
  const code = output.find(chunk => chunk.isEntry)?.code
  await bundle.close()
  if (typeof code !== 'string') throw new Error('worker bundle entry missing')
  return code
}

async function buildEsm(input, target) {
  const bundle = await rolldown({ input: fileURL(input), external: EXTERNAL_NODE_BUILTINS, transform: TRANSFORM })
  const { output } = await bundle.generate({ format: 'es' })
  const code = output.find(chunk => chunk.isEntry)?.code
  await bundle.close()
  if (typeof code !== 'string') throw new Error(`${target} entry missing`)
  return code
}

function fileURL(path) {
  return new URL(path, root).href
}

await mkdir(new URL('lib/', root), { recursive: true })
await writeFile(new URL('lib/client.js', root), await buildClient())
await writeFile(new URL('lib/vega-lite.worker.js', root), await buildWorker())
await writeFile(new URL('lib/index.js', root), await buildEsm('src/index.ts', 'lib/index.js'))
await writeFile(new URL('lib/skill.js', root), await buildEsm('src/skill-entry.ts', 'lib/skill.js'))
await writeFile(new URL('lib/invariant.js', root), await buildEsm('src/invariant.ts', 'lib/invariant.js'))
console.log('lib/ artifacts rebuilt from src/')
