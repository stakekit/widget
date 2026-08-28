import type { YieldAction } from "../../../domain/action/models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";

export type ActivityActionItem = {
  readonly actionData: YieldAction;
  readonly validatorsData: ReadonlyArray<EarnValidator>;
  readonly walletScope: WalletScopeKey;
  readonly yieldData: EarnYieldWithProvider | null;
};
