/// <reference types="vite/client" />

/**
 * Declares the VITE_-prefixed variables this app reads. Vite inlines these into
 * the public bundle at build time, so only non-sensitive values belong here.
 * `VITE_` values are readable by anyone loading the site.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
