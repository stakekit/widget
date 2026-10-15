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
    readonly VITE_ENABLE_MSW_MOCK: string;
    readonly VITE_FORCE_ADDRESS?: string;
    /** Standalone app only: `true` | `false`; overrides the `borrow` query param. */
    readonly VITE_FORCE_BORROW?: string;
    /** Standalone app only: `true` | `false`; overrides the `variant` query param. */
    readonly VITE_FORCE_DASHBOARD?: string;
    /** Standalone app only: `dark` | `light`; overrides the `theme` query param. */
    readonly VITE_APP_THEME?: string;
    readonly VITE_APP_VARIANT?: "default" | "utila" | "finery" | "porto";
    readonly VITE_YIELDS_API_URL: string;
    readonly VITE_BORROW_API_URL?: string;
  }
}

export {};
