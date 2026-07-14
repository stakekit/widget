import { Data } from "effect";
import type { TokenBalanceScanCommand } from "../../../../../../domain/schema/financial-models";
import type {
  WalletAddress,
  YieldId,
} from "../../../../../../domain/schema/identifiers";
import type { Network } from "../../../../../../domain/schema/network-model";

import type { DashboardYieldCategory } from "../../../../../../domain/types/yields";
import type { EarnTokenOption } from "../types";

export class AvailableYieldCategoriesKey extends Data.TaggedClass(
  "AvailableYieldCategoriesKey"
)<{
  network: Network | null;
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
  address: WalletAddress | null;
  network: Network | null;
}> {}

export class TokenOptionsKey extends Data.TaggedClass("TokenOptionsKey")<{
  address: WalletAddress | null;
  additionalAddresses?:
    | TokenBalanceScanCommand["addresses"]["additionalAddresses"]
    | null;
  network: Network | null;
  category: DashboardYieldCategory | null;
  initToken: string | null;
  initTokenNetwork: Network | null;
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
  network: Network | null;
  category: DashboardYieldCategory | null;
  tokensForEnabledYieldsOnly: boolean;
}> {}

export class TokenBalancesScanKey extends Data.TaggedClass(
  "TokenBalancesScanKey"
)<{
  address: WalletAddress | null;
  additionalAddresses?:
    | TokenBalanceScanCommand["addresses"]["additionalAddresses"]
    | null;
  network: Network | null;
}> {}

export class InitTokenOptionKey extends Data.TaggedClass("InitTokenOptionKey")<{
  token: string | null;
  network: Network | null;
}> {}

export class YieldValidatorsKey extends Data.TaggedClass("YieldValidatorsKey")<{
  selectedYieldId: YieldId;
}> {}

export class YieldValidatorsPullKey extends Data.TaggedClass(
  "YieldValidatorsPullKey"
)<{
  search: string | null;
}> {}
