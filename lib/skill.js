import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
//#region src/skill-entry.ts
/**
* Optional node-half companion: exposes the packaged `dsh-diagram-design`
* skill through the host skill registry (`ctx.skills`). This module is a
* separate Cordis entry (`dsh-visualization/skill`) so a composition without
* the `skills` service only skips this companion; the visualization plugin
* itself keeps loading.
* @module dsh-visualization/skill
*/
/** Cordis plugin name for the skill companion entry. */
const name = "dsh-visualization-skill";
/** The host skill registry; absent compositions skip this entry. */
const inject = ["skills"];
const SKILL_NAME = "dsh-diagram-design";
const SKILL_DESCRIPTION = "Polished, presentation-grade static engineering diagrams (architecture, flowchart, sequence, state, data flow, swimlane, deployment, dependency, ER, tree, layers, org chart, timeline, and related types) for DeepSeek Harness, rendered as a single fenced `dsh-svg` SVG code block. Use only when the user explicitly asks for a refined or presentation-grade diagram — e.g. \"精排图\", \"用于展示\", \"精排\", \"按 diagram-design 绘制\" — or when earlier conversation turns load this skill. Do not use for ordinary diagrams (DSH defaults to Mermaid), numeric charts (use `vega-lite`), or detail data (use tables).";
const SKILL_RESOURCE_BASE = fileURLToPath(new URL("../skill/dsh-diagram-design/", import.meta.url));
const SKILL_BODY_PATH = fileURLToPath(new URL("../skill/dsh-diagram-design/SKILL.md", import.meta.url));
/** Standard precedence rank for packaged skill providers; user and project skills win. */
const BUNDLED_SKILL_RANK = 600;
const PROVIDER_NAME = "dsh-visualization";
/**
* Register the packaged diagram-design skill provider.
* @param ctx - host context carrying the skill registry.
*/
function apply(ctx) {
	ctx.skills.registerProvider(() => ({
		name: PROVIDER_NAME,
		list: () => Promise.resolve([{
			name: SKILL_NAME,
			description: SKILL_DESCRIPTION,
			invocation: {
				modelInvocable: true,
				userInvocable: true
			},
			provider: PROVIDER_NAME,
			source: "bundled",
			resourceBase: {
				kind: "directory",
				path: SKILL_RESOURCE_BASE
			},
			rank: BUNDLED_SKILL_RANK,
			locator: SKILL_BODY_PATH
		}]),
		async get() {
			return {
				name: SKILL_NAME,
				description: SKILL_DESCRIPTION,
				invocation: {
					modelInvocable: true,
					userInvocable: true
				},
				provider: PROVIDER_NAME,
				source: "bundled",
				resourceBase: {
					kind: "directory",
					path: SKILL_RESOURCE_BASE
				},
				content: await readFile(SKILL_BODY_PATH, "utf8")
			};
		}
	}));
}
//#endregion
export { apply, inject, name };
