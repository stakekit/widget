/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_KEY: string;
  readonly VITE_ANALYTICS_LOGGING: string;
  readonly VITE_FORCE_WALLET_CONNECT_ONLY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
