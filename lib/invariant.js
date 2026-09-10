//#region src/invariant.ts
const PACKAGE_NAME = "dsh-visualization";
/** Cordis companion plugin name. */
const name = "dsh-visualization-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* No runtime invariant: the package owns visualization surfaces, browser-only
* renderer registrations, and static prompt sections, but no event, service, or
* shared mutable product state. Focused browser tests assert renderer lifecycles.
*/
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
