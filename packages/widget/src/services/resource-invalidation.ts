import { Data } from "effect";
import type { BorrowNetwork } from "../domain/borrow/network";
import type { WalletScopeKey } from "./wallet/domain/scope";

export class WalletBalancesInvalidationKey extends Data.TaggedClass(
  "WalletBalancesInvalidationKey"
)<{
  readonly scope: WalletScopeKey;
}> {}

export class YieldPositionsInvalidationKey extends Data.TaggedClass(
  "YieldPositionsInvalidationKey"
)<{
  readonly scope: WalletScopeKey;
}> {}

export class ActivityInvalidationKey extends Data.TaggedClass(
  "ActivityInvalidationKey"
)<{
  readonly scope: WalletScopeKey;
}> {}

export class BorrowPositionsInvalidationKey extends Data.TaggedClass(
  "BorrowPositionsInvalidationKey"
)<{
  readonly scope: WalletScopeKey;
}> {}

export class BorrowMarketsInvalidationKey extends Data.TaggedClass(
  "BorrowMarketsInvalidationKey"
)<{
  readonly network: BorrowNetwork;
}> {}

type OptionalWalletScope = WalletScopeKey | null | undefined;

const optionalWalletScopeKeys =
  <Key>(makeKey: (scope: WalletScopeKey) => Key) =>
  (scope: OptionalWalletScope): ReadonlyArray<Key> =>
    scope ? [makeKey(scope)] : [];

export const resourceInvalidationKeys = {
  activity: optionalWalletScopeKeys(
    (scope) => new ActivityInvalidationKey({ scope })
  ),
  borrowMarkets: (network: BorrowNetwork) => [
    new BorrowMarketsInvalidationKey({ network }),
  ],
  borrowPositions: optionalWalletScopeKeys(
    (scope) => new BorrowPositionsInvalidationKey({ scope })
  ),
  walletBalances: optionalWalletScopeKeys(
    (scope) => new WalletBalancesInvalidationKey({ scope })
  ),
  yieldPositions: optionalWalletScopeKeys(
    (scope) => new YieldPositionsInvalidationKey({ scope })
  ),
} as const;
