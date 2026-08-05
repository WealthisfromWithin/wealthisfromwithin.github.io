/// <reference types="vite/client" />

/**
 * Build-time configuration. Only values that are safe to ship publicly may
 * appear here: a `VITE_*` variable is inlined into the bundle, so a credential
 * in this list would be a published credential (ARCHITECTURE_AUDIT §5.9).
 */
interface ImportMetaEnv {
  /** Base URL of a model runtime on the operator's own machine, e.g. http://localhost:11434. */
  readonly VITE_LOCAL_AI_URL?: string;
  readonly VITE_LOCAL_AI_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
