#!/usr/bin/env node
/**
 * Provision a pinned DSH runtime for the upstream-hooks guard (ADR-0011).
 *
 * Installs the umbrella package @deepseek-ai/dsh-web-app@<scripts/runtime-pin.json>
 * into .dsh-ci-runtime/ — its dependency tree transitively pins the entire
 * synchronized @deepseek-ai/dsh-* family at the same exact version (including
 * dsh-web-frontend's dist assets), so scripts/verify-upstream-hooks.mjs runs
 * in strict (pnpm-store) mode with a near-complete page-wide inventory.
 *
 * Idempotent: an existing install of the same pin is reused as-is. Exports
 * DSH_RUNTIME_ROOT via $GITHUB_ENV on CI; locally prints the export line.
 *
 * --ignore-scripts: the guard only reads lib/*.js and dist assets; package
 * lifecycle scripts are unnecessary and stay disabled.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pin = JSON.parse(readFileSync(join(root, "scripts/runtime-pin.json"), "utf8")).version;
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(pin)) {
	console.error(`ci-install-runtime: scripts/runtime-pin.json version must be exact semver (X.Y.Z[-pre]), got "${pin}" — a mutable dist-tag here would make CI verification non-reproducible (ADR-0011)`);
	process.exit(1);
}
const target = join(root, ".dsh-ci-runtime");
const umbrella = `@deepseek-ai/dsh-web-app@${pin}`;

const marker = join(target, "node_modules/@deepseek-ai/dsh-web-app/package.json");
const installed = existsSync(marker) && JSON.parse(readFileSync(marker, "utf8")).version === pin;
if (installed) {
	console.log(`ci-install-runtime: ${umbrella} already provisioned — reusing .dsh-ci-runtime/`);
} else {
	mkdirSync(target, { recursive: true });
	// A local package.json is REQUIRED before pnpm add: without a project
	// boundary here, pnpm walks up and installs into (and corrupts) the
	// repo's own manifest and lockfile.
	writeFileSync(join(target, "package.json"), `${JSON.stringify({ name: "dsh-ci-runtime", private: true }, null, "\t")}\n`);
	const res = spawnSync("pnpm", ["add", umbrella, "--ignore-scripts", "--prefer-offline"], { cwd: target, stdio: "inherit" });
	if (res.error !== undefined || res.status !== 0) {
		console.error(`ci-install-runtime: pnpm add ${umbrella} failed (exit ${res.status ?? "?"})`);
		process.exit(res.status ?? 1);
	}
}

const pnpmDir = join(target, "node_modules/.pnpm");
const count = existsSync(pnpmDir) ? readdirSync(pnpmDir).filter((e) => e.startsWith("@deepseek-ai+")).length : 0;
console.log(`ci-install-runtime: runtime ${pin} ready — ${count} @deepseek-ai packages under .dsh-ci-runtime/`);
if (process.env.GITHUB_ENV) {
	appendFileSync(process.env.GITHUB_ENV, `\nDSH_RUNTIME_ROOT=${target}\n`);
	console.log("ci-install-runtime: DSH_RUNTIME_ROOT exported via GITHUB_ENV");
} else {
	console.log(`ci-install-runtime: next step → export DSH_RUNTIME_ROOT="${target}"`);
}
