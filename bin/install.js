#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_NAME = 'dsh-visualization'
const DEFAULT_SOURCE = 'github:shaomingbo/dsh-visualization#v0.2.5'
const COMMANDS = new Set(['install', 'status', 'uninstall'])

function parseArgs(argv) {
  const result = {
    command: 'install',
    profile: 'web',
    source: process.env.DSH_VISUALIZATION_SOURCE || DEFAULT_SOURCE,
    help: false,
  }
  let commandSeen = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (COMMANDS.has(arg) && !commandSeen) {
      result.command = arg
      commandSeen = true
    } else if (arg === '--profile' || arg === '--source') {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`)
      if (arg === '--profile') result.profile = value
      else result.source = value
    } else if (arg === '--help' || arg === '-h') {
      result.help = true
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  return result
}

function usage() {
  return `Usage: ${PACKAGE_NAME} [install|status|uninstall] [--profile web] [--source ${DEFAULT_SOURCE}]

Commands:
  install     Install or update the bundle (default when omitted)
  status      Show whether the bundle is installed
  uninstall   Remove the bundle from the profile

Options:
  --profile   Target DSH profile (default: web)
  --source    Fixed tag or local link source
  --help      Show this help`
}

function runPackageInstall(profileDir) {
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
  const temp = `${path}.${process.pid}.dsh-visualization.tmp`
  try {
    await writeFile(temp, content, 'utf8')
    await rename(temp, path)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseManifest(source) {
  let manifest
  try {
    manifest = JSON.parse(source)
  } catch (error) {
    throw new Error(`profile package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isRecord(manifest)) throw new Error('profile package.json must contain a JSON object')
  if (manifest.dependencies !== undefined && !isRecord(manifest.dependencies)) {
    throw new Error('profile dependencies must be an object')
  }
  if (manifest.dsh !== undefined && !isRecord(manifest.dsh)) throw new Error('profile dsh must be an object')
  if (isRecord(manifest.dsh) && manifest.dsh.profile !== undefined && !isRecord(manifest.dsh.profile)) {
    throw new Error('profile dsh.profile must be an object')
  }
  const bundles = isRecord(manifest.dsh) && isRecord(manifest.dsh.profile)
    ? manifest.dsh.profile.bundles
    : undefined
  if (bundles !== undefined && (!Array.isArray(bundles) || !bundles.every(item => typeof item === 'string'))) {
    throw new Error('profile dsh.profile.bundles must be an array of strings')
  }
  return manifest
}

function getInstallation(manifest) {
  const source = isRecord(manifest.dependencies) && typeof manifest.dependencies[PACKAGE_NAME] === 'string'
    ? manifest.dependencies[PACKAGE_NAME]
    : undefined
  const bundles = isRecord(manifest.dsh) && isRecord(manifest.dsh.profile) && Array.isArray(manifest.dsh.profile.bundles)
    ? manifest.dsh.profile.bundles
    : []
  return { source, enabled: bundles.includes(PACKAGE_NAME) }
}

function ensureInstallStructures(manifest) {
  manifest.dependencies ||= {}
  manifest.dsh ||= {}
  manifest.dsh.profile ||= {}
  manifest.dsh.profile.bundles ||= []
}

async function writeAndInstall(packagePath, profileDir, original, manifest) {
  await atomicWrite(packagePath, `${JSON.stringify(manifest, null, 2)}\n`)
  try {
    runPackageInstall(profileDir)
  } catch (error) {
    await atomicWrite(packagePath, original)
    throw error
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const dshHome = resolve(process.env.DSH_HOME || join(homedir(), '.dsh'))
  const profileDir = join(dshHome, 'profiles', options.profile)
  const packagePath = join(profileDir, 'package.json')
  const original = await readFile(packagePath, 'utf8')
  const manifest = parseManifest(original)

  if (options.command === 'status') {
    const installation = getInstallation(manifest)
    if (installation.source && installation.enabled) {
      console.log(`${PACKAGE_NAME} is installed in ${profileDir} from ${installation.source}`)
    } else if (!installation.source && !installation.enabled) {
      console.log(`${PACKAGE_NAME} is not installed in ${profileDir}`)
    } else {
      console.log(`${PACKAGE_NAME} is partially configured in ${profileDir}`)
    }
    return
  }

  if (options.command === 'install') {
    ensureInstallStructures(manifest)
    manifest.dependencies[PACKAGE_NAME] = options.source
    if (!manifest.dsh.profile.bundles.includes(PACKAGE_NAME)) {
      manifest.dsh.profile.bundles.push(PACKAGE_NAME)
    }
    await writeAndInstall(packagePath, profileDir, original, manifest)
    console.log(`\nInstalled ${PACKAGE_NAME} into ${profileDir} from ${options.source}`)
  } else {
    if (isRecord(manifest.dependencies)) delete manifest.dependencies[PACKAGE_NAME]
    if (isRecord(manifest.dsh) && isRecord(manifest.dsh.profile) && Array.isArray(manifest.dsh.profile.bundles)) {
      manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter(item => item !== PACKAGE_NAME)
    }
    await writeAndInstall(packagePath, profileDir, original, manifest)
    console.log(`\nUninstalled ${PACKAGE_NAME} from ${profileDir}`)
  }

  console.log('Restart DSH manually, then hard-refresh the existing Web GUI.')
}

main().catch((error) => {
  const script = fileURLToPath(import.meta.url)
  console.error(`${script}: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
