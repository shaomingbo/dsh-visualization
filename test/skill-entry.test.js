import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const skillDir = join(root, 'skill', 'dsh-diagram-design')
const skillEntry = await import(join(root, 'lib', 'skill.js'))
const skillBody = await readFile(join(skillDir, 'SKILL.md'), 'utf8')

function fakeRegistry() {
  const factories = []
  return {
    factories,
    skills: {
      registerProvider(create) {
        factories.push(create)
        return () => {}
      },
    },
  }
}

test('skill companion registers a bundled provider with an isolated contract', () => {
  assert.equal(skillEntry.name, 'dsh-visualization-skill')
  assert.deepEqual(skillEntry.inject, ['skills'])
  const registry = fakeRegistry()
  skillEntry.apply(registry)
  assert.equal(registry.factories.length, 1)
  const provider = registry.factories[0]()
  assert.equal(provider.name, 'dsh-visualization')
  return provider.list({}).then(async (candidates) => {
    assert.equal(candidates.length, 1)
    const candidate = candidates[0]
    assert.equal(candidate.name, 'dsh-diagram-design')
    assert.equal(candidate.source, 'bundled')
    // Packaged skills must never outrank a user's own skill of the same name.
    assert.equal(candidate.rank, 600)
    assert.deepEqual(candidate.invocation, { modelInvocable: true, userInvocable: true })
    assert.equal(candidate.resourceBase.kind, 'directory')
    assert.equal(candidate.resourceBase.path, join(skillDir) + '/')
    const definition = await provider.get(candidate, {})
    assert.equal(definition.name, candidate.name)
    assert.equal(definition.description, candidate.description)
    assert.ok(definition.content.includes('dsh-svg'), 'skill body must teach the dsh-svg protocol')
    assert.ok(definition.content.length > 1000)
  })
})

test('catalog description stays in sync with the packaged SKILL.md frontmatter', async () => {
  const frontmatter = /^---\nname: (.+)\ndescription: (.+)\n/m.exec(skillBody)
  assert.ok(frontmatter, 'SKILL.md must start with name/description frontmatter')
  const registry = fakeRegistry()
  skillEntry.apply(registry)
  const provider = registry.factories[0]()
  const [candidate] = await provider.list({})
  assert.equal(candidate.name, frontmatter[1].trim())
  assert.equal(candidate.description, frontmatter[2].trim())
})

test('every relative reference in the skill body resolves inside the package', async () => {
  const links = [...skillBody.matchAll(/`((?:references\/)[a-z-]+\.md)`/g)].map(match => match[1])
  assert.ok(links.length >= 15, `expected a reference index, found ${links.length}`)
  links.push('PROVENANCE.md', 'LICENSE')
  for (const link of new Set(links)) {
    await access(join(skillDir, link))
  }
})

test('pinned upstream references ship verbatim with provenance and license', async () => {
  const provenance = await readFile(join(skillDir, 'PROVENANCE.md'), 'utf8')
  assert.match(provenance, /cathrynlavery\/diagram-design/)
  assert.match(provenance, /562dbdf93ff3c3da630be4f90f4f6c2548175058/)
  const license = await readFile(join(skillDir, 'LICENSE'), 'utf8')
  assert.match(license, /Copyright \(c\) 2025 Cathryn Lavery/)
  const listed = [...provenance.matchAll(/`([a-z-]+\.md)`/g)].map(match => match[1])
  for (const name of ['type-architecture.md', 'type-flowchart.md', 'type-sequence.md', 'semantic-patterns.md', 'style-guide.md']) {
    assert.ok(listed.includes(name), `provenance omits shipped reference ${name}`)
    await access(join(skillDir, 'references', name))
  }
  // Animation/HTML-export guidance must not ship: the DSH channel is static SVG only.
  await assert.rejects(access(join(skillDir, 'references', 'animation.md')))
  await assert.rejects(access(join(skillDir, 'references', 'export.md')))
})

test('adapted skill keeps the fidelity-first rules over upstream deletion philosophy', async () => {
  assert.match(skillBody, /信息保真/)
  assert.match(skillBody, /总览 \+ 细节/)
  assert.match(skillBody, /不触发重绘/)
  assert.match(skillBody, /PingFang SC/)
  assert.match(skillBody, /128 KiB/)
  assert.match(skillBody, /marker-start/)
})
