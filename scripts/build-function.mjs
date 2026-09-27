import { build } from 'esbuild';
import { readFile, rm } from 'node:fs/promises';

/**
 * Serverless bundle preflight.
 *
 * Vercel compiles api/index.ts to real ESM in /var/task and executes it with
 * Node. Node's ESM resolver does no extension guessing and no directory-index
 * lookup, so every relative import must be written with an explicit extension
 * ('./config.js', './db/index.js'). The root tsconfig.json cannot enforce that,
 * because it uses moduleResolution 'bundler' for the Vite client build.
 *
 * This walks the entire relative-import graph reachable from the serverless
 * entry point and fails the build on anything that would not resolve on Vercel.
 * It is a preflight, not the deploy artifact: the emitted bundle is discarded.
 * `packages: 'external'` keeps node_modules out of it, so the check stays fast
 * and isolates exactly the thing that broke - our own module specifiers.
 *
 * Exits non-zero on any unresolved or extensionless relative import, so a
 * regression fails `npm run build` on Vercel instead of 500ing every /api route
 * at cold start.
 */

const ENTRY = 'api/index.ts';
const OUTFILE = 'dist-server/index.js';

async function main() {
  await rm('dist-server', { recursive: true, force: true });

  const result = await build({
    entryPoints: [ENTRY],
    outfile: OUTFILE,
    bundle: true,
    packages: 'external',
    platform: 'node',
    target: 'node20',
    format: 'esm',
    sourcemap: false,
    metafile: true,
    logLevel: 'warning',
  });

  if (result.errors.length > 0) {
    console.error(`[build:server] FAILED - ${result.errors.length} unresolved import(s) in the serverless graph.`);
    process.exit(1);
  }

  // Defence in depth: even if the graph bundled, assert the emitted specifiers
  // are the kind Node can resolve unaided.
  const emitted = await readFile(OUTFILE, 'utf8');
  const bad = [...emitted.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']*)["']/g)]
    .map((match) => match[1])
    .filter((specifier) => !/\.(js|mjs|cjs|json)$/.test(specifier));

  if (bad.length > 0) {
    console.error('[build:server] FAILED - extensionless relative import(s) in the emitted bundle:');
    for (const specifier of new Set(bad)) console.error(`  ${specifier}`);
    process.exit(1);
  }

  const modules = Object.keys(result.metafile.inputs).length;
  console.log(`[build:server] ok - ${modules} modules resolved from ${ENTRY}`);
}

main().catch((error) => {
  console.error('[build:server] FAILED', error?.message || error);
  process.exit(1);
});
