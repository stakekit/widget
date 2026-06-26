import { Data } from "effect";
import type { Networks } from "../../../../../../domain/types/chains/networks";
import type { TokenBalanceScanDto } from "../../../../../../domain/types/token-balance";
import type { DashboardYieldCategory } from "../../../../../../domain/types/yields";
import type { YieldDto } from "../../../../../../generated/api/yield";
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
  yieldId: string | null;
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
  initYieldId: string | null;
  tokensForEnabledYieldsOnly: boolean;
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
  selectedYieldId: YieldDto["id"];
}> {}

export class YieldValidatorsPullKey extends Data.TaggedClass(
  "YieldValidatorsPullKey"
)<{
  search: string | null;
}> {}
