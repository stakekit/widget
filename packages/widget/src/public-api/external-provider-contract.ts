import type {
  SKBorrowExternalProviders,
  SKExternalProviders,
} from "./types.js";

export type ExternalProviderSnapshot =
  | Readonly<SKExternalProviders>
  | Readonly<SKBorrowExternalProviders>;

export const isBorrowExternalProvider = (
  snapshot: ExternalProviderSnapshot
): snapshot is Readonly<SKBorrowExternalProviders> =>
  snapshot.supportsBorrow === true;
