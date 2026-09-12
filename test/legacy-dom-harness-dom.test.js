import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { readLegacyFenceTarget } from '../src/client/legacy-dom.ts'

const fixture = readFileSync(new URL('./fixtures/harness-code-block-0.1.5.html', import.meta.url), 'utf8')

function documentFor() {
  return parseHTML(fixture).document
}

/**
 * Regression guard for the 0.1.5 code-block DOM: the `<pre>` sits inside
 * `[data-code-block-content]`, so the banner is the content seat's previous
 * sibling, not the `<pre>`'s. The reader used to return `null` for every fence
 * here, which silently disabled every visualization on those Hosts.
 */
test('reads the real 0.1.5 code-block DOM captured from the Web GUI', () => {
  const document = documentFor()
  const shell = document.querySelector('[data-fixture="csv-0.1.5"] .md-code-block')
  const target = readLegacyFenceTarget(document.querySelector('[data-fixture="csv-0.1.5"] code'))
  assert.equal(target?.language, 'csv')
  assert.equal(target?.source, 'name,type,version\ndsh-visualization,plugin,0.3.5\ndsh-token-usage,plugin,5.1.8')
  assert.equal(target?.shell, shell)
})

test('reads a Mermaid fence from the real 0.1.5 DOM', () => {
  const document = documentFor()
  const target = readLegacyFenceTarget(document.querySelector('[data-fixture="mermaid-0.1.5"] code'))
  assert.equal(target?.language, 'mermaid')
  assert.equal(target?.source, 'flowchart LR\n  A["fence"] -->|legacy adapter| B["mount"]')
  assert.equal(target?.shell, document.querySelector('[data-fixture="mermaid-0.1.5"] .md-code-block'))
})

test('still reads the pre-0.1.5 sibling markup', () => {
  const document = documentFor()
  const target = readLegacyFenceTarget(document.querySelector('[data-fixture="csv-pre-0.1.5"] code'))
  assert.equal(target?.language, 'csv')
  assert.equal(target?.source, 'legacy,markup\ncsv,table')
  assert.equal(target?.shell, document.querySelector('[data-fixture="csv-pre-0.1.5"] .md-code-block'))
})
