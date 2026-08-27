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

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-visualization-installer-'))
  const dshHome = join(directory, 'dsh-home')
  const profileDir = join(dshHome, 'profiles', 'web')
  const fakeBin = join(directory, 'bin')
  const pnpmLog = join(directory, 'pnpm.log')
  await mkdir(profileDir, { recursive: true })
  await mkdir(fakeBin, { recursive: true })
  const original = `${JSON.stringify({
    dependencies: { existing: '1.0.0' },
    dsh: { profile: { bundles: ['existing'] } },
    private: true,
  }, null, 2)}\n`
  await writeFile(join(profileDir, 'package.json'), original)
  const fakePnpm = join(fakeBin, 'pnpm')
  await writeFile(fakePnpm, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$FAKE_PNPM_LOG"\nexit "${FAKE_PNPM_EXIT:-0}"\n')
  await chmod(fakePnpm, 0o755)
  const env = {
    DSH_HOME: dshHome,
    FAKE_PNPM_LOG: pnpmLog,
    PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
  }
  return {
    directory,
    env,
    original,
    packagePath: join(profileDir, 'package.json'),
    pnpmLog,
  }
}

async function readManifest(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

test('help documents fixed release source and all installer commands', () => {
  const result = run(['--help'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /github:shaomingbo\/dsh-visualization#v0\.2\.5/)
  assert.match(result.stdout, /install\|status\|uninstall/)
  assert.match(result.stdout, /--profile web/)
})

test('install is idempotent, status is read-only, and uninstall removes only this bundle', async () => {
  const item = await fixture()
  try {
    const source = 'link:/tmp/dsh-visualization'
    for (const args of [
      ['--source', source],
      ['install', '--source', source],
    ]) {
      const result = run(args, item.env)
      assert.equal(result.status, 0, result.stderr)
      const manifest = await readManifest(item.packagePath)
      assert.deepEqual(manifest.dependencies, { existing: '1.0.0', 'dsh-visualization': source })
      assert.deepEqual(manifest.dsh.profile.bundles, ['existing', 'dsh-visualization'])
      assert.equal(manifest.private, true)
    }

    const beforeStatus = await readFile(item.packagePath, 'utf8')
    const status = run(['status'], item.env)
    assert.equal(status.status, 0, status.stderr)
    assert.match(status.stdout, /installed/)
    assert.match(status.stdout, /link:\/tmp\/dsh-visualization/)
    assert.equal(await readFile(item.packagePath, 'utf8'), beforeStatus)

    const uninstall = run(['uninstall'], item.env)
    assert.equal(uninstall.status, 0, uninstall.stderr)
    const manifest = await readManifest(item.packagePath)
    assert.deepEqual(manifest.dependencies, { existing: '1.0.0' })
    assert.deepEqual(manifest.dsh.profile.bundles, ['existing'])
    assert.equal(manifest.private, true)

    const absent = run(['status'], item.env)
    assert.equal(absent.status, 0, absent.stderr)
    assert.match(absent.stdout, /not installed/)
    const pnpmCalls = (await readFile(item.pnpmLog, 'utf8')).trim().split('\n')
    assert.deepEqual(pnpmCalls, [
      'install --ignore-scripts',
      'install --ignore-scripts',
      'install --ignore-scripts',
    ])
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})

test('malformed manifests and invalid arguments fail without running pnpm', async () => {
  const item = await fixture()
  try {
    await writeFile(item.packagePath, '{not json')
    const malformed = run(['install'], item.env)
    assert.notEqual(malformed.status, 0)
    assert.equal(await readFile(item.packagePath, 'utf8'), '{not json')
    await assert.rejects(readFile(item.pnpmLog, 'utf8'), error => error?.code === 'ENOENT')

    for (const args of [['unknown'], ['--profile'], ['--source']]) {
      const invalid = run(args, item.env)
      assert.notEqual(invalid.status, 0)
    }
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})

test('dependency installation failure restores the original manifest', async () => {
  const item = await fixture()
  try {
    const result = run(['install', '--source', 'link:/tmp/failing'], {
      ...item.env,
      FAKE_PNPM_EXIT: '7',
    })
    assert.notEqual(result.status, 0)
    assert.equal(await readFile(item.packagePath, 'utf8'), item.original)
  } finally {
    await rm(item.directory, { recursive: true, force: true })
  }
})
