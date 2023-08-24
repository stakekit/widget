/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_KEY: string;
  readonly VITE_USE_LEDGER_SIMULATOR: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
