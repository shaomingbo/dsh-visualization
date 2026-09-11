import assert from 'node:assert/strict'
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const installer = join(root, 'bin', 'install.js')

function run(args, env = {}) {
  return spawnSync(process.execPath, [installer, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

/**
 * A stand-in for the official `dsh` CLI (verified behavior of
 * 0.1.2-alpha.3): `--version`, then `plugin --profile <name> <args...>`
 * which initializes a missing profile and forwards to pnpm, reconciling
 * `dsh.profile.bundles` against the dependency the command managed.
 */
const FAKE_DSH = `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const [,, command, ...rest] = process.argv
const appendLog = () => {
  if (process.env.FAKE_DSH_LOG) {
    fs.appendFileSync(process.env.FAKE_DSH_LOG, [command, ...rest].join(' ') + '\\n')
  }
}
if (command === '--version') {
  appendLog()
  console.log(process.env.FAKE_DSH_VERSION ?? '0.1.2-alpha.3')
  process.exit(0)
}
if (command === 'plugin') {
  appendLog()
  const flag = rest.indexOf('--profile')
  const profile = rest[flag + 1]
  const args = rest.slice(flag + 2)
  const dir = path.join(process.env.FAKE_DSH_HOME, 'profiles', profile)
  fs.mkdirSync(dir, { recursive: true })
  const packagePath = path.join(dir, 'package.json')
  if (!fs.existsSync(packagePath)) {
    fs.writeFileSync(packagePath, JSON.stringify({
      name: \`dsh-profile-\${profile}\`,
      private: true,
      dependencies: {},
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
    }, null, 2) + '\\n')
  }
  const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  if (args[0] === 'add') {
    const spec = args[1]
    const name = spec.includes('dsh-visualization') ? 'dsh-visualization' : \`pkg:\${spec}\`
    manifest.dependencies[name] = spec
    if (!manifest.dsh.profile.bundles.includes(name)) manifest.dsh.profile.bundles.push(name)
  } else if (args[0] === 'remove') {
    delete manifest.dependencies['dsh-visualization']
    manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter(item => item !== 'dsh-visualization')
  }
  fs.writeFileSync(packagePath, JSON.stringify(manifest, null, 2) + '\\n')
  process.exit(process.env.FAKE_DSH_EXIT ? Number(process.env.FAKE_DSH_EXIT) : 0)
}
process.exit(1)
`

async function fixture({ withProfile = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-visualization-installer-'))
  const dshHome = join(directory, 'dsh-home')
  const profileDir = join(dshHome, 'profiles', 'web')
  const fakeBin = join(directory, 'bin')
  const dshLog = join(directory, 'dsh.log')
  await mkdir(fakeBin, { recursive: true })
  let original
  if (withProfile) {
    await mkdir(profileDir, { recursive: true })
    original = `${JSON.stringify({
      dependencies: { existing: '1.0.0' },
      dsh: { profile: { bundles: ['existing'] } },
      private: true,
    }, null, 2)}\n`
    await writeFile(join(profileDir, 'package.json'), original)
  }
  const fakeDsh = join(fakeBin, 'dsh')
  await writeFile(fakeDsh, FAKE_DSH)
  await chmod(fakeDsh, 0o755)
  const env = {
    DSH_HOME: dshHome,
    FAKE_DSH_HOME: dshHome,
    FAKE_DSH_LOG: dshLog,
    PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
  }
  return {
    directory,
    dshLog,
    env,
    original,
    packagePath: join(profileDir, 'package.json'),
    profileDir,
  }
}

async function readManifest(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function readLog(path) {
  return (await readFile(path, 'utf8')).trim().split('\n')
}

test('help documents the fixed release source, commands, and the dsh CLI requirement', () => {
  const result = run(['--help'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /github:shaomingbo\/dsh-visualization#v0\.3\.2/)
  assert.match(result.stdout, /install\|status\|uninstall/)
  assert.match(result.stdout, /--profile web/)
  assert.match(result.stdout, /dsh plugin/)
  assert.match(result.stdout, /0\.1\.2-alpha\.3/)
})

test('install initializes a fresh profile through the official CLI and is idempotent', async () => {
  const item = await fixture()
  try {
    const source = 'github:shaomingbo/dsh-visualization#v0.3.3'
    for (const args of [
      ['--source', source],
      ['install', '--source', source],
    ]) {
      const result = run(args, item.env)
      assert.equal(result.status, 0, result.stderr)
      const manifest = await readManifest(item.packagePath)
      assert.equal(manifest.dependencies['dsh-visualization'], source)
      assert.equal(manifest.dsh.profile.bundles.includes('dsh-visualization'), true)
      // The official CLI owns the manifest: only the bundle entry is added.
      assert.equal(manifest.dsh.profile.bundles.includes('@deepseek-ai/dsh-base'), true)
    }
    const status = run(['status'], item.env)
    assert.equal(status.status, 0, status.stderr)
    assert.match(status.stdout, /installed/)
    assert.match(status.stdout, /github:shaomingbo\/dsh-visualization#v0\.3\.2/)
    const calls = await readLog(item.dshLog)
    assert.deepEqual(calls.filter(line => line.startsWith('plugin')), [
      'plugin --profile web add github:shaomingbo/dsh-visualization#v0.3.3 --config.ignore-scripts=true',
      'plugin --profile web add github:shaomingbo/dsh-visualization#v0.3.3 --config.ignore-scripts=true',
    ])
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})

test('status is read-only and clean on a missing or malformed profile', async () => {
  const item = await fixture()
  try {
    const missing = run(['status'], item.env)
    assert.equal(missing.status, 0, missing.stderr)
    assert.match(missing.stdout, /not installed/)
    assert.equal(await readFile(item.dshLog, 'utf8').then(() => true, error => error?.code === 'ENOENT'), true)
    await mkdir(join(item.directory, 'dsh-home', 'profiles', 'web'), { recursive: true })
    await writeFile(item.packagePath, '{not json')
    const malformed = run(['status'], item.env)
    assert.notEqual(malformed.status, 0)
    assert.match(malformed.stderr, /not valid JSON/)
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})

test('uninstall removes only this bundle and is idempotent', async () => {
  const item = await fixture({ withProfile: true })
  try {
    const install = run(['install', '--source', 'link:/tmp/dsh-visualization'], item.env)
    assert.equal(install.status, 0, install.stderr)
    const uninstall = run(['uninstall'], item.env)
    assert.equal(uninstall.status, 0, uninstall.stderr)
    const manifest = await readManifest(item.packagePath)
    assert.deepEqual(manifest.dependencies, { existing: '1.0.0' })
    assert.equal(manifest.dsh.profile.bundles.includes('dsh-visualization'), false)
    assert.equal(manifest.dsh.profile.bundles.includes('existing'), true)
    const callsAfterFirst = (await readLog(item.dshLog)).filter(line => line.startsWith('plugin')).length
    const absent = run(['uninstall'], item.env)
    assert.equal(absent.status, 0, absent.stderr)
    assert.match(absent.stdout, /not installed/)
    const callsAfterSecond = (await readLog(item.dshLog)).filter(line => line.startsWith('plugin')).length
    assert.equal(callsAfterSecond, callsAfterFirst)
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})

test('a missing dsh fails with guidance and never writes anything', async () => {
  const item = await fixture()
  try {
    const result = run(['install'], {
      ...item.env,
      PATH: '/usr/bin:/bin',
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /dsh CLI was not found/)
    assert.match(result.stderr, /0\.1\.2-alpha\.3/)
    await assert.rejects(readFile(item.packagePath, 'utf8'), error => error?.code === 'ENOENT')
    await assert.rejects(readFile(item.dshLog, 'utf8'), error => error?.code === 'ENOENT')
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})

test('an unverified dsh version fails with the verified matrix and never writes', async () => {
  const item = await fixture()
  try {
    const result = run(['install'], { ...item.env, FAKE_DSH_VERSION: '0.1.2-alpha.9' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /0\.1\.2-alpha\.9/)
    assert.match(result.stderr, /0\.1\.2-alpha\.3/)
    assert.equal(await readFile(item.packagePath, 'utf8').then(() => true, error => error?.code === 'ENOENT'), true)
    // Only the --version probe ran; the management command was never called.
    const calls = await readLog(item.dshLog)
    assert.deepEqual(calls, ['--version'])
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})

test('exact 0.1.5-rc.1 CLI is accepted by the installer matrix', async () => {
  const item = await fixture()
  try {
    const result = run(['install'], { ...item.env, FAKE_DSH_VERSION: '0.1.5-rc.1' })
    assert.equal(result.status, 0, result.stderr)
    const calls = await readLog(item.dshLog)
    assert.ok(calls.includes('--version'))
    assert.ok(calls.some((line) => line.startsWith('plugin ')))
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})

test('official CLI failures surface with context instead of a fallback', async () => {
  const item = await fixture()
  try {
    const result = run(['install'], { ...item.env, FAKE_DSH_EXIT: '7' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /dsh plugin add failed/)
    assert.match(result.stderr, /exit code 7/)
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})

test('invalid arguments fail without touching anything', async () => {
  const item = await fixture()
  try {
    for (const args of [['unknown'], ['--profile'], ['--source']]) {
      const invalid = run(args, item.env)
      assert.notEqual(invalid.status, 0)
    }
    assert.equal(await readFile(item.dshLog, 'utf8').then(() => true, error => error?.code === 'ENOENT'), true)
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})