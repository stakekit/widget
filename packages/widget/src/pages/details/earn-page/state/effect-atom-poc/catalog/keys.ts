import { Data } from "effect";
import type { YieldId } from "../../../../../../domain/schema/identifiers";
import type { Networks } from "../../../../../../domain/types/chains/networks";
import type { TokenBalanceScanDto } from "../../../../../../domain/types/token-balance";
import type { DashboardYieldCategory } from "../../../../../../domain/types/yields";
import type { EarnTokenOption } from "../types";

export class AvailableYieldCategoriesKey extends Data.TaggedClass(
  "AvailableYieldCategoriesKey"
)<{
  network: Networks | null;
  categoryOrder: ReadonlyArray<DashboardYieldCategory>;
}> {}

export class YieldCatalogKey extends Data.TaggedClass("YieldCatalogKey")<{
  selectedToken: EarnTokenOption;
  category: DashboardYieldCategory | null;
}> {}

export class InitYieldKey extends Data.TaggedClass("InitYieldKey")<{
  yieldId: YieldId | null;
}> {}

export class PositionsDataKey extends Data.TaggedClass("PositionsDataKey")<{
  address: string | null;
  network: Networks | null;
}> {}

export class TokenOptionsKey extends Data.TaggedClass("TokenOptionsKey")<{
  address: string | null;
  additionalAddresses?:
    | TokenBalanceScanDto["addresses"]["additionalAddresses"]
    | null;
  network: Networks | null;
  category: DashboardYieldCategory | null;
  initToken: string | null;
  initTokenNetwork: Networks | null;
  initYieldId: YieldId | null;
  tokensForEnabledYieldsOnly: boolean;
}> {}

export class TokenYieldScopeKey extends Data.TaggedClass("TokenYieldScopeKey")<{
  category: DashboardYieldCategory | null;
  yieldIds: ReadonlyArray<YieldId>;
}> {}

export class DefaultTokenOptionsKey extends Data.TaggedClass(
  "DefaultTokenOptionsKey"
)<{
  network: Networks | null;
  category: DashboardYieldCategory | null;
  tokensForEnabledYieldsOnly: boolean;
}> {}

export class TokenBalancesScanKey extends Data.TaggedClass(
  "TokenBalancesScanKey"
)<{
  address: string | null;
  additionalAddresses?:
    | TokenBalanceScanDto["addresses"]["additionalAddresses"]
    | null;
  network: Networks | null;
}> {}

export class InitTokenOptionKey extends Data.TaggedClass("InitTokenOptionKey")<{
  token: string | null;
  network: Networks | null;
}> {}

export class YieldValidatorsKey extends Data.TaggedClass("YieldValidatorsKey")<{
  selectedYieldId: YieldId;
}> {}

export class YieldValidatorsPullKey extends Data.TaggedClass(
  "YieldValidatorsPullKey"
)<{
  search: string | null;
}> {}
