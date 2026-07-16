import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  ActionCommand,
  YieldAction,
} from "../../../domain/schema/action-models";
import type { WalletAddresses } from "../../../domain/schema/address-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { AppToken } from "../../../domain/schema/legacy-models";
import type { ValidatorKey } from "../../../domain/types/validators";
import {
  type ClassicTransactionWorkflowKey,
  type ClassicTransactionWorkflowProviderDetail,
  makeClassicTransactionWorkflowKey,
} from "../../../services/workflow/transaction-workflow-model";
import { selectAtom } from "../../../shared/effect/select-atom";

export type EnterStakeRequest = {
  readonly actionDto: YieldAction | null;
  readonly addresses: WalletAddresses;
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly requestDto: ActionCommand;
  readonly selectedStake: EarnYieldWithProvider;
  readonly selectedToken: AppToken;
  readonly selectedValidators: Map<ValidatorKey, EarnValidator>;
};

export const enterStakeRequestAtom = Atom.make<EnterStakeRequest | null>(
  null
).pipe(Atom.keepAlive, Atom.withLabel("enterStakeRequestAtom"));

export const enterTransactionWorkflowKeyAtom = selectAtom(
  enterStakeRequestAtom,
  (request): ClassicTransactionWorkflowKey | null =>
    request?.actionDto
      ? makeClassicTransactionWorkflowKey({
          action: request.actionDto,
          inputToken: request.selectedToken,
          providersDetails: request.providersDetails,
        })
      : null
);
