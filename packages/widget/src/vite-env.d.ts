/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_KEY: string;
  readonly VITE_ANALYTICS_LOGGING: string;
  readonly VITE_FORCE_WALLET_CONNECT_ONLY: string;
  readonly VITE_ENABLE_MSW_MOCK: string;
  readonly VITE_FORCE_ADDRESS: string | undefined;
  readonly VITE_FORCE_DASHBOARD: string;
  readonly VITE_APP_VARIANT: "utila" | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
