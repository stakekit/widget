import { Data } from "effect";
import type { BorrowNetwork } from "../domain/borrow/network";
import type { WalletAddress } from "../domain/schema/identifiers";
import {
  type WalletScopeKey,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "./wallet/domain/scope";

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
  readonly address: WalletAddress;
}> {}

export class ActivityInvalidationKey extends Data.TaggedClass(
  "ActivityInvalidationKey"
)<{
  readonly scope: WalletScopeOwnerKey;
}> {
  constructor(input: { readonly scope: WalletScopeKey | WalletScopeOwnerKey }) {
    super({ scope: walletScopeOwnerKey(input.scope) });
  }
}

export class BorrowPositionsInvalidationKey extends Data.TaggedClass(
  "BorrowPositionsInvalidationKey"
)<{
  readonly scope: WalletScopeOwnerKey;
}> {
  constructor(input: { readonly scope: WalletScopeKey | WalletScopeOwnerKey }) {
    super({ scope: walletScopeOwnerKey(input.scope) });
  }
}

export class BorrowMarketsInvalidationKey extends Data.TaggedClass(
  "BorrowMarketsInvalidationKey"
)<{
  readonly network: BorrowNetwork;
}> {}

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
  singleYieldBalances: (address: WalletAddress) => [
    new SingleYieldBalancesInvalidationKey({ address }),
  ],
  walletBalances: optionalWalletOwnerKeys(
    (scope) => new WalletBalancesInvalidationKey({ scope })
  ),
  yieldPositions: optionalWalletOwnerKeys(
    (scope) => new YieldPositionsInvalidationKey({ scope })
  ),
} as const;
