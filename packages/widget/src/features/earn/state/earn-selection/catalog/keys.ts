import { Data } from "effect";
import type { YieldId } from "../../../../../domain/identity/identifiers";
import type { Network } from "../../../../../domain/network/network";
import type { DashboardYieldCategory } from "../../../../../public-api/types";
import type { WalletScopeKey } from "../../../../../services/wallet/wallet-scope";

export class AvailableYieldCategoriesKey extends Data.TaggedClass(
  "AvailableYieldCategoriesKey"
)<{
  network: Network | null;
  categoryOrder: ReadonlyArray<DashboardYieldCategory>;
}> {}

export class YieldCatalogKey extends Data.TaggedClass("YieldCatalogKey")<{
  category: DashboardYieldCategory | null;
  network: Network;
  yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor(input: {
    readonly category: DashboardYieldCategory | null;
    readonly network: Network;
    readonly yieldIds: ReadonlyArray<YieldId>;
  }) {
    super({
      ...input,
      yieldIds: [...new Set(input.yieldIds)].sort(),
    });
  }
}

export class InitYieldKey extends Data.TaggedClass("InitYieldKey")<{
  yieldId: YieldId | null;
}> {}

export class PositionsDataKey extends Data.TaggedClass("PositionsDataKey")<{
  scope: WalletScopeKey | null;
}> {}

export class TokenOptionsKey extends Data.TaggedClass("TokenOptionsKey")<{
  scope: WalletScopeKey | null;
  category: DashboardYieldCategory | null;
  initToken: string | null;
  initTokenNetwork: Network | null;
  initYieldId: YieldId | null;
  preferredTokenNetwork: Network | null;
  preferredTokenKeys: ReadonlyArray<string>;
  tokensForEnabledYieldsOnly: boolean;
}> {
  constructor(input: {
    readonly scope: WalletScopeKey | null;
    readonly category: DashboardYieldCategory | null;
    readonly initToken: string | null;
    readonly initTokenNetwork: Network | null;
    readonly initYieldId: YieldId | null;
    readonly preferredTokenNetwork?: Network | null;
    readonly preferredTokenKeys?: ReadonlyArray<string>;
    readonly tokensForEnabledYieldsOnly: boolean;
  }) {
    super({
      ...input,
      preferredTokenNetwork: input.preferredTokenNetwork ?? null,
      preferredTokenKeys: [...new Set(input.preferredTokenKeys ?? [])].sort(),
    });
  }
}

export class TokenYieldScopeKey extends Data.TaggedClass("TokenYieldScopeKey")<{
  category: DashboardYieldCategory | null;
  yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor(input: {
    readonly category: DashboardYieldCategory | null;
    readonly yieldIds: ReadonlyArray<YieldId>;
  }) {
    super({
      ...input,
      yieldIds: [...new Set(input.yieldIds)].sort(),
    });
  }
}

export class DefaultTokenOptionsKey extends Data.TaggedClass(
  "DefaultTokenOptionsKey"
)<{
  network: Network | null;
  category: DashboardYieldCategory | null;
  tokensForEnabledYieldsOnly: boolean;
}> {}

export class TokenBalancesScanKey extends Data.TaggedClass(
  "TokenBalancesScanKey"
)<{
  scope: WalletScopeKey | null;
}> {}

export class InitTokenOptionKey extends Data.TaggedClass("InitTokenOptionKey")<{
  token: string | null;
  network: Network | null;
}> {}

export class YieldValidatorsKey extends Data.TaggedClass("YieldValidatorsKey")<{
  network: Network | null;
  selectedYieldId: YieldId;
}> {
  constructor(input: {
    readonly network?: Network | null;
    readonly selectedYieldId: YieldId;
  }) {
    super({ ...input, network: input.network ?? null });
  }
}

export class YieldValidatorsPullKey extends Data.TaggedClass(
  "YieldValidatorsPullKey"
)<{
  search: string | null;
}> {}
