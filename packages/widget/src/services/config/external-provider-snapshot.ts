import type {
  SKBorrowExternalProviders,
  SKExternalProviders,
} from "../../public-api/types";

/**
 * Host external provider captured at the configuration boundary. `borrow` is
 * decided there from `borrowEnabled`, never from host-provided flags.
 */
export type ExternalProviderSnapshot =
  | (Readonly<Omit<SKExternalProviders, "provider" | "supportsBorrow">> & {
      readonly borrow: false;
      readonly provider:
        | SKExternalProviders["provider"]
        | SKBorrowExternalProviders["provider"];
    })
  | (Readonly<SKBorrowExternalProviders> & { readonly borrow: true });
