import type {
  SKBorrowExternalProviders,
  SKExternalProviders,
} from "../../public-api/types";

/**
 * Host external provider captured at the configuration boundary. `borrow` is
 * decided there from `borrowEnabled`, never from host-provided flags.
 */
export type ExternalProviderSnapshot =
  | (Readonly<Omit<SKExternalProviders, "supportsBorrow">> & {
      readonly borrow: false;
    })
  | (Readonly<SKBorrowExternalProviders> & { readonly borrow: true });
