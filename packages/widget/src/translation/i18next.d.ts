import "i18next";

import type { localResources } from ".";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      [Key in keyof (typeof localResources)["en"]]: (typeof localResources)["en"][Key] & {
        errors: Record<string, string>;
      };
    };
  }
}
