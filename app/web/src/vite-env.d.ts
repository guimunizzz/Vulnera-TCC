/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_TURNSTILE_ACTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
