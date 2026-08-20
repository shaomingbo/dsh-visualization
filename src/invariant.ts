/**
 * Package-owned invariant companion for `dsh-visualization`.
 * @module dsh-visualization/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-visualization'

/** Cordis companion plugin name. */
export const name = 'dsh-visualization-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package owns visualization surfaces, browser-only
 * renderer registrations, and static prompt sections, but no event, service, or
 * shared mutable product state. Focused browser tests assert renderer lifecycles.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
