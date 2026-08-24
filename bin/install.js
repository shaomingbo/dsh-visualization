#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_NAME = 'dsh-visualization'
const DEFAULT_SOURCE = 'github:shaomingbo/dsh-visualization#v0.2.3'

function parseArgs(argv) {
  const result = { profile: 'web', source: process.env.DSH_VISUALIZATION_SOURCE || DEFAULT_SOURCE }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--profile') result.profile = argv[++index]
    else if (arg === '--source') result.source = argv[++index]
    else if (arg === '--help' || arg === '-h') result.help = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (!result.profile || !result.source) throw new Error('--profile and --source require values')
  return result
}

function runInstall(profileDir) {
  const attempts = [
    ['pnpm', ['install', '--ignore-scripts']],
    ['corepack', ['pnpm', 'install', '--ignore-scripts']],
  ]
  for (const [command, args] of attempts) {
    const result = spawnSync(command, args, { cwd: profileDir, stdio: 'inherit' })
    if (!result.error && result.status === 0) return
    if (result.error?.code !== 'ENOENT') {
      throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
    }
  }
  throw new Error('pnpm is unavailable; install pnpm or enable it with corepack')
}

async function atomicWrite(path, content) {
  const temp = `${path}.dsh-visualization.tmp`
  try {
    await writeFile(temp, content, 'utf8')
    await rename(temp, path)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(`Usage: ${PACKAGE_NAME} [--profile web] [--source ${DEFAULT_SOURCE}]\n\nInstalls the visualization bundle into a DSH profile.`)
    return
  }

  const dshHome = resolve(process.env.DSH_HOME || join(homedir(), '.dsh'))
  const profileDir = join(dshHome, 'profiles', options.profile)
  const packagePath = join(profileDir, 'package.json')
  const original = await readFile(packagePath, 'utf8')
  const manifest = JSON.parse(original)

  manifest.dependencies ||= {}
  manifest.dependencies[PACKAGE_NAME] = options.source
  manifest.dsh ||= {}
  manifest.dsh.profile ||= {}
  manifest.dsh.profile.bundles ||= []
  if (!manifest.dsh.profile.bundles.includes(PACKAGE_NAME)) {
    manifest.dsh.profile.bundles.push(PACKAGE_NAME)
  }

  await atomicWrite(packagePath, `${JSON.stringify(manifest, null, 2)}\n`)
  try {
    runInstall(profileDir)
  } catch (error) {
    await atomicWrite(packagePath, original)
    throw error
  }

  console.log(`\nInstalled ${PACKAGE_NAME} into ${profileDir}`)
  console.log('Restart DSH and hard-refresh the Web page so the renderer bundle enters the boot graph.')
}

main().catch((error) => {
  const script = fileURLToPath(import.meta.url)
  console.error(`${script}: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
