import type { YieldAction } from "../../../domain/schema/action-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";

export type ActivityActionItem = {
  readonly actionData: YieldAction;
  readonly validatorsData: ReadonlyArray<EarnValidator>;
  readonly walletScope: WalletScopeKey;
  readonly yieldData: EarnYieldWithProvider | null;
};
