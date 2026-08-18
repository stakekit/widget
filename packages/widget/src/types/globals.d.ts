/// <reference types="vite/client" />

declare global {
  interface Window {
    keplr?: unknown;
    leap?: unknown;
    cactus?: unknown;
    mpcvaultPlugin?: unknown;
  }

  interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_API_KEY: string;
    readonly VITE_ANALYTICS_LOGGING: string;
    readonly VITE_FORCE_WALLET_CONNECT_ONLY: string;
    readonly VITE_ENABLE_MSW_MOCK: string;
    readonly VITE_FORCE_ADDRESS?: string;
    readonly VITE_FORCE_BORROW: string;
    readonly VITE_FORCE_DASHBOARD: string;
    readonly VITE_APP_VARIANT?: "default" | "utila" | "finery" | "porto";
    readonly VITE_YIELDS_API_URL: string;
    readonly VITE_BORROW_API_URL?: string;
  }
}

export {};
