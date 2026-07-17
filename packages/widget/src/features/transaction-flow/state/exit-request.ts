import type BigNumber from "bignumber.js";
import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  ActionCommand,
  YieldAction,
} from "../../../domain/schema/action-models";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { AppToken } from "../../../domain/schema/legacy-models";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import {
  type ClassicTransactionWorkflowKey,
  type ClassicTransactionWorkflowProviderDetail,
  makeClassicTransactionWorkflowKey,
} from "../../../services/workflow/transaction-workflow-model";
import { selectAtom } from "../../../shared/effect/select-atom";
import { makeTransactionWorkflowLifecycleAtom } from "./workflow-lifecycle";

export type ExitStakeRequest = {
  readonly actionDto: YieldAction | null;
  readonly gasFeeToken: EarnYieldWithProvider["token"];
  readonly integrationData: EarnYieldWithProvider;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly requestDto: ActionCommand;
  readonly unstakeAmount: BigNumber;
  readonly unstakeToken: AppToken;
  readonly walletScope: WalletScopeKey;
};

export const exitStakeRequestAtom = Atom.make<ExitStakeRequest | null>(
  null
).pipe(Atom.keepAlive, Atom.withLabel("exitStakeRequestAtom"));

export const exitTransactionWorkflowLifecycleAtom =
  makeTransactionWorkflowLifecycleAtom(
    exitStakeRequestAtom,
    "exitTransactionWorkflowLifecycleAtom"
  );

export const exitTransactionWorkflowKeyAtom = selectAtom(
  exitStakeRequestAtom,
  (request): ClassicTransactionWorkflowKey | null =>
    request?.actionDto
      ? makeClassicTransactionWorkflowKey({
          action: request.actionDto,
          inputToken: request.unstakeToken,
          providersDetails: request.providersDetails,
          walletScope: request.walletScope,
        })
      : null
);
