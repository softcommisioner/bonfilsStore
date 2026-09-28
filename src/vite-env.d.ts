/**
 * Declares the VITE_-prefixed variables this app reads. Vite inlines these into
 * the public bundle at build time, so only non-sensitive values belong here.
 * `VITE_` values are readable by anyone loading the site.
 *
 * The two interfaces are declared here in full on purpose, and this file
 * deliberately does NOT carry `/// <reference types="vite/client" />`.
 *
 * A triple-slash `types` reference raises the same TS2688 as a
 * `compilerOptions.types` entry ("Cannot find type definition file for
 * 'vite/client'"), so keeping one here would reintroduce exactly the build
 * failure it looks like it is fixing. It was never needed: this app reads only
 * the two VITE_ keys below, never `import.meta.hot`, `import.meta.glob`,
 * `import.meta.url` or `import.meta.env.MODE`, so Vite's own client.d.ts has
 * nothing left to contribute. `import.meta.env` is rewritten at build time by
 * Vite/esbuild and does not require its type declarations to type-check, so the
 * Vite types are not part of this build's contract.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Stylesheet side-effect imports (`import './index.css'`) have no type
 * declarations of their own. Vite's client.d.ts supplied these, so dropping
 * that reference without replacing it produced TS2882. Declaring the handful
 * this app actually imports keeps the surface small and explicit rather than
 * re-declaring every asset extension Vite knows about.
 */
declare module '*.css' {}
