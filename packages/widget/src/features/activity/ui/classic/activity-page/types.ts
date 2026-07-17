import type { YieldAction } from "../../../../../domain/schema/action-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../domain/schema/earn-models";
import type { WalletScopeKey } from "../../../../../services/wallet/domain/scope";

export type ActionYieldDto = {
  actionData: YieldAction;
  yieldData: EarnYieldWithProvider | null;
  validatorsData: EarnValidator[];
  walletScope: WalletScopeKey;
};
