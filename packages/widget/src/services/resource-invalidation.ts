import { Data } from "effect";

import type { BorrowNetwork } from "../domain/borrow/network";
import {
  type WalletScopeKey,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../domain/wallet/wallet-scope";

export class WalletBalancesInvalidationKey extends Data.TaggedClass(
  "WalletBalancesInvalidationKey"
)<{
  readonly scope: WalletScopeOwnerKey;
}> {
  constructor(input: { readonly scope: WalletScopeKey | WalletScopeOwnerKey }) {
    super({ scope: walletScopeOwnerKey(input.scope) });
  }
}

export class YieldPositionsInvalidationKey extends Data.TaggedClass(
  "YieldPositionsInvalidationKey"
)<{
  readonly scope: WalletScopeOwnerKey;
}> {
  constructor(input: { readonly scope: WalletScopeKey | WalletScopeOwnerKey }) {
    super({ scope: walletScopeOwnerKey(input.scope) });
  }
}

export class SingleYieldBalancesInvalidationKey extends Data.TaggedClass(
  "SingleYieldBalancesInvalidationKey"
)<{
  readonly scope: WalletScopeOwnerKey;
}> {
  constructor(input: { readonly scope: WalletScopeKey | WalletScopeOwnerKey }) {
    super({ scope: walletScopeOwnerKey(input.scope) });
  }
}

export class ActivityInvalidationKey extends Data.TaggedClass(
  "ActivityInvalidationKey"
)<{
  readonly scope: WalletScopeOwnerKey;
}> {
  constructor(input: { readonly scope: WalletScopeKey | WalletScopeOwnerKey }) {
    super({ scope: walletScopeOwnerKey(input.scope) });
  }
}

class BorrowPositionsInvalidationKey extends Data.TaggedClass(
  "BorrowPositionsInvalidationKey"
)<{
  readonly scope: WalletScopeOwnerKey;
}> {
  constructor(input: { readonly scope: WalletScopeKey | WalletScopeOwnerKey }) {
    super({ scope: walletScopeOwnerKey(input.scope) });
  }
}

class BorrowMarketsInvalidationKey extends Data.TaggedClass(
  "BorrowMarketsInvalidationKey"
)<{
  readonly network: BorrowNetwork;
}> {}

/**
 * The yields API's catalog: the yields, the tokens that earn in them and
 * their validators, which no wallet owns. Invalidated to load them again,
 * such as from a failed page's Retry.
 */
class YieldCatalogInvalidationKey extends Data.TaggedClass(
  "YieldCatalogInvalidationKey"
)<Record<never, never>> {}

type OptionalWalletOwnerScope =
  | WalletScopeKey
  | WalletScopeOwnerKey
  | null
  | undefined;

const optionalWalletOwnerKeys =
  <Key>(makeKey: (scope: WalletScopeKey | WalletScopeOwnerKey) => Key) =>
  (scope: OptionalWalletOwnerScope): ReadonlyArray<Key> =>
    scope ? [makeKey(scope)] : [];

export const resourceInvalidationKeys = {
  activity: optionalWalletOwnerKeys(
    (scope) => new ActivityInvalidationKey({ scope })
  ),
  borrowMarkets: (network: BorrowNetwork) => [
    new BorrowMarketsInvalidationKey({ network }),
  ],
  borrowPositions: optionalWalletOwnerKeys(
    (scope) => new BorrowPositionsInvalidationKey({ scope })
  ),
  singleYieldBalances: optionalWalletOwnerKeys(
    (scope) => new SingleYieldBalancesInvalidationKey({ scope })
  ),
  walletBalances: optionalWalletOwnerKeys(
    (scope) => new WalletBalancesInvalidationKey({ scope })
  ),
  yieldCatalog: () => [new YieldCatalogInvalidationKey()],
  yieldPositions: optionalWalletOwnerKeys(
    (scope) => new YieldPositionsInvalidationKey({ scope })
  ),
} as const;
