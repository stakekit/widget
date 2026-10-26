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
    /** Development only: replaces the connected wallet's address. */
    readonly VITE_FORCE_ADDRESS?: string;
    readonly VITE_YIELDS_API_URL: string;
    readonly VITE_BORROW_API_URL?: string;
  }
}

export {};
