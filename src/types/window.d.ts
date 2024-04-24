declare global {
  interface Window {
    keplr?: any;
    leap?: any;
    Intercom?: (
      event: "boot" | "update" | "hide_default_launcher",
      opts: {
        api_base?: string;
        app_id?: string;
        address?: string;
        hide_default_launcher?: boolean;
      }
    ) => void;
  }
}

export {};
