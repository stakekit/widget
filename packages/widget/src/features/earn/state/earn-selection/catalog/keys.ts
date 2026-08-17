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

export class PositionsDataKey extends Data.TaggedClass("PositionsDataKey")<{
  scope: WalletScopeKey | null;
}> {}

export class TokenOptionsKey extends Data.TaggedClass("TokenOptionsKey")<{
  scope: WalletScopeKey | null;
  category: DashboardYieldCategory | null;
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
