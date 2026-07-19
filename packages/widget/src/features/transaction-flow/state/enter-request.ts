import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  ActionCommand,
  YieldAction,
} from "../../../domain/schema/action-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { AppToken } from "../../../domain/schema/legacy-models";
import type { ValidatorKey } from "../../../domain/types/validators";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../services/workflow/transaction-workflow-model";

type EnterStakeRequest = {
  readonly actionDto: YieldAction | null;
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly requestDto: ActionCommand;
  readonly selectedStake: EarnYieldWithProvider;
  readonly selectedToken: AppToken;
  readonly selectedValidators: Map<ValidatorKey, EarnValidator>;
  readonly walletScope: WalletScopeKey;
};

export const enterStakeRequestAtom = Atom.make<EnterStakeRequest | null>(
  null
).pipe(Atom.keepAlive, Atom.withLabel("enterStakeRequestAtom"));
