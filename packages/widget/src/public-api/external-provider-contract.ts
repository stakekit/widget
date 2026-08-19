import type { SKBorrowExternalProviders, SKExternalProviders } from "./types";

export type ExternalProviderSnapshot =
  | Readonly<SKExternalProviders>
  | Readonly<SKBorrowExternalProviders>;

export const isBorrowExternalProvider = (
  snapshot: ExternalProviderSnapshot
): snapshot is Readonly<SKBorrowExternalProviders> =>
  snapshot.supportsBorrow === true;

export const hasValidBorrowProviderContract = (
  snapshot: ExternalProviderSnapshot
): boolean =>
  isBorrowExternalProvider(snapshot) &&
  typeof snapshot.provider.sendBorrowTransaction === "function";
