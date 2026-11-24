import { build, context } from "esbuild";
import { readFile } from "node:fs/promises";
import process from "node:process";

// Asset cache-busting rev (ADR-0023 Decision 4): injected as the esbuild
// define key `globalThis.__VFT_ASSET_REV__`. The fully-qualified key is
// required — a bare `__VFT_ASSET_REV__` define does NOT substitute
// `globalThis.X` property reads (verified against esbuild 0.28.2), and the
// bundle would silently pin every asset URL to the "0" fallback.
const { version } = JSON.parse(await readFile("package.json", "utf8"));

const clientOptions = {
  entryPoints: ["src/client/index.js"],
  outfile: "lib/client.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  legalComments: "none",
  charset: "utf8",
  sourcemap: false,
  define: {
    "globalThis.__VFT_ASSET_REV__": JSON.stringify(version),
  },
};

const hostOptions = {
  entryPoints: ["src/index.js"],
  outfile: "lib/index.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  packages: "external",
  legalComments: "none",
  charset: "utf8",
  sourcemap: false,
};

// The CLI is bundled too: the published package ships `lib/` and `cli/` but not
// `src/`, and cli/vft.mjs imports the shared model. One self-contained ESM file
// keeps the installed CLI runnable with nothing but Node.
const cliOptions = {
  entryPoints: ["cli/vft.mjs"],
  outfile: "lib/cli.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  packages: "external",
  legalComments: "none",
  charset: "utf8",
  sourcemap: false,
};

async function validateOutputs() {
  const { name } = JSON.parse(await readFile("package.json", "utf8"));
  const [client, host, cli] = await Promise.all([
    readFile(clientOptions.outfile, "utf8"),
    readFile(hostOptions.outfile, "utf8"),
    readFile(cliOptions.outfile, "utf8"),
  ]);
  // The registration id must equal the package name: the boot page keys
  // __DSH_BOOT__ entries by package name, and dsh-client-modules throws
  // "loaded without registering" when a bundle registers under any other id.
  if (!client.includes(`id: "${name}"`) || !client.includes("window.__ModuleLoader__.load")) {
    throw new Error(
      `generated client bundle is missing the DSH module wrapper: expected registration id "${name}" (src/client/index.js must register under the package.json name)`,
    );
  }
  if (!host.includes("/vyra-free-theme/config") || !host.includes("personalization routes")) {
    throw new Error("generated host bundle is missing the personalization routes");
  }
  if (host.includes("/vyra-free-theme/update") || host.includes("self-update routes")) {
    throw new Error("generated host bundle still contains self-update remnants");
  }
  if (!cli.includes("vyra-free-theme CLI") || !cli.includes("vyra-free-theme/selection.json") && !cli.includes("selection.json")) {
    throw new Error("generated CLI bundle is missing its command surface");
  }
  console.log(`built ${clientOptions.outfile} (${Buffer.byteLength(client)} bytes)`);
  console.log(`built ${hostOptions.outfile} (${Buffer.byteLength(host)} bytes)`);
  console.log(`built ${cliOptions.outfile} (${Buffer.byteLength(cli)} bytes)`);
}

if (process.argv.includes("--watch")) {
  const [client, host, cli] = await Promise.all([context(clientOptions), context(hostOptions), context(cliOptions)]);
  await Promise.all([client.watch(), host.watch(), cli.watch()]);
  console.log("watching src/ -> lib/client.js, lib/index.js and cli/ -> lib/cli.mjs");
} else {
  await Promise.all([build(clientOptions), build(hostOptions), build(cliOptions)]);
  await validateOutputs();
}
