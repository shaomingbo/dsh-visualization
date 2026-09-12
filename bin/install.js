#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PACKAGE_NAME = 'dsh-visualization'
const DEFAULT_SOURCE = 'github:shaomingbo/dsh-visualization#v0.3.5'
/** Exact CLI versions this installer has been unit-tested against. Host web/base must still be smoke-tested per version. */
const VERIFIED_DSH_VERSIONS = ['0.1.2-alpha.3', '0.1.5-rc.1', '0.1.5-rc.2']
const VERIFIED_DSH_VERSION = VERIFIED_DSH_VERSIONS[0]
const VERIFIED_HOST = 'DSH web/base 0.1.2-rc.1, 0.1.5-rc.1, or 0.1.5-rc.2'
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
  status      Read-only check whether the bundle is installed
  uninstall   Remove the bundle from the profile

Options:
  --profile   Target DSH profile (default: web)
  --source    Fixed tag or local link source
  --help      Show this help

Install and uninstall delegate to the official \`dsh plugin\` management
command, which initializes the profile and maintains the bundle list.
Verified installer matrix: dsh ${VERIFIED_DSH_VERSIONS.join(' or ')} with ${VERIFIED_HOST}.`
}

function profilePackagePath(profile) {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(dshHome, 'profiles', profile, 'package.json')
}

/**
 * Read-only manifest inspection. Missing profiles, missing files, and broken
 * JSON are reported as values instead of crashing the CLI.
 */
async function readProfileState(profile) {
  const packagePath = profilePackagePath(profile)
  let source
  try {
    const raw = await readFile(packagePath, 'utf8')
    let manifest
    try {
      manifest = JSON.parse(raw)
    } catch (error) {
      return { state: 'unreadable', packagePath, reason: `profile package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}` }
    }
    const dependencies = manifest?.dependencies
    source = typeof dependencies?.[PACKAGE_NAME] === 'string' ? dependencies[PACKAGE_NAME] : undefined
    const bundles = Array.isArray(manifest?.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles : []
    const enabled = bundles.includes(PACKAGE_NAME)
    if (source !== undefined && enabled) return { state: 'installed', packagePath, source }
    if (source === undefined && !enabled) return { state: 'absent', packagePath }
    return { state: 'partial', packagePath, source }
  } catch (error) {
    if (error?.code === 'ENOENT') return { state: 'absent', packagePath }
    return { state: 'unreadable', packagePath, reason: error instanceof Error ? error.message : String(error) }
  }
}

/** Probe the dsh CLI and gate on the verified version; no side effects. */
function detectDsh() {
  const probe = spawnSync('dsh', ['--version'], { encoding: 'utf8' })
  if (probe.error?.code === 'ENOENT') return { ok: false, reason: 'missing' }
  if (probe.error !== undefined || probe.status !== 0) return { ok: false, reason: 'unknown' }
  const version = (probe.stdout ?? '').trim()
  if (version === '') return { ok: false, reason: 'unknown' }
  if (!VERIFIED_DSH_VERSIONS.includes(version)) return { ok: false, reason: 'unverified', version }
  return { ok: true, version }
}

function dshFailureGuidance(detection) {
  if (detection.reason === 'missing') {
    return `The dsh CLI was not found on PATH. Install DeepSeek Harness first (it provides dsh and the profiles/ layout), then re-run this installer. Verified installer matrix: dsh ${VERIFIED_DSH_VERSIONS.join(' or ')} with ${VERIFIED_HOST}.`
  }
  const detected = detection.version !== undefined ? ` Detected dsh ${detection.version}.` : ''
  return `dsh ${VERIFIED_DSH_VERSIONS.join(' or ')} are the only CLI versions this installer has verified (with ${VERIFIED_HOST}).${detected} Switch the dsh CLI to a verified version and re-run; see the README for the verified matrix.`
}

/** Run one official management command and return its result. */
function runDshPlugin(profile, args) {
  return spawnSync('dsh', ['plugin', '--profile', profile, ...args], { encoding: 'utf8' })
}

function describeResult(result) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  return output === '' ? '' : `\n${output.split('\n').slice(-8).join('\n')}`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  if (options.command === 'status') {
    const state = await readProfileState(options.profile)
    if (state.state === 'installed') console.log(`${PACKAGE_NAME} is installed in ${join(state.packagePath, '..')} from ${state.source}`)
    else if (state.state === 'absent') console.log(`${PACKAGE_NAME} is not installed in profile "${options.profile}"`)
    else if (state.state === 'partial') console.log(`${PACKAGE_NAME} is partially configured in profile "${options.profile}" (source: ${state.source ?? 'none'})`)
    else {
      console.error(`Cannot read profile "${options.profile}": ${state.reason}`)
      process.exitCode = 1
    }
    return
  }

  const detection = detectDsh()
  if (!detection.ok) {
    console.error(dshFailureGuidance(detection))
    process.exitCode = 1
    return
  }

  if (options.command === 'install') {
    const result = runDshPlugin(options.profile, ['add', options.source, '--config.ignore-scripts=true'])
    if (result.status !== 0) {
      console.error(`dsh plugin add failed with exit code ${result.status}.${describeResult(result)}`)
      process.exitCode = 1
      return
    }
    const state = await readProfileState(options.profile)
    if (state.state !== 'installed') {
      console.error(`Install postcondition not met after "dsh plugin add": profile "${options.profile}" does not list ${PACKAGE_NAME} as an installed bundle.`)
      process.exitCode = 1
      return
    }
    console.log(`\nInstalled ${PACKAGE_NAME} into profile "${options.profile}" from ${options.source} (dsh ${detection.version}).`)
  } else {
    const state = await readProfileState(options.profile)
    if (state.state === 'absent') {
      console.log(`\n${PACKAGE_NAME} is not installed in profile "${options.profile}"; nothing to uninstall.`)
      return
    }
    // pnpm 11 rejects `remove --ignore-scripts`; the config form is accepted
    // by both add and remove and keeps lifecycle scripts disabled either way.
    const result = runDshPlugin(options.profile, ['remove', PACKAGE_NAME, '--config.ignore-scripts=true'])
    if (result.status !== 0) {
      console.error(`dsh plugin remove failed with exit code ${result.status}.${describeResult(result)}`)
      process.exitCode = 1
      return
    }
    const after = await readProfileState(options.profile)
    if (after.state === 'installed' || after.state === 'partial') {
      console.error(`Uninstall postcondition not met after "dsh plugin remove": profile "${options.profile}" still lists ${PACKAGE_NAME}.`)
      process.exitCode = 1
      return
    }
    console.log(`\nUninstalled ${PACKAGE_NAME} from profile "${options.profile}" (dsh ${detection.version}).`)
  }

  console.log('Restart DSH manually, then hard-refresh the existing Web GUI.')
}

main().catch((error) => {
  console.error(`dsh-visualization: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})