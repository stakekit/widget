import * as Atom from "effect/unstable/reactivity/Atom";
import type {
  ManageActionCommand,
  YieldAction,
} from "../../../domain/schema/action-models";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import type { AppToken } from "../../../domain/schema/legacy-models";
import type { YieldPendingActionType } from "../../../domain/types/pending-action";
import type { WalletScopeKey } from "../../../services/wallet/domain/scope";
import {
  type ClassicTransactionWorkflowKey,
  type ClassicTransactionWorkflowProviderDetail,
  makeClassicTransactionWorkflowKey,
} from "../../../services/workflow/transaction-workflow-model";
import { selectAtom } from "../../../shared/effect/select-atom";
import { makeTransactionWorkflowLifecycleAtom } from "./workflow-lifecycle";

export type PendingActionRequest = {
  readonly actionDto: YieldAction | null;
  readonly gasFeeToken: AppToken;
  readonly integrationData: EarnYieldWithProvider;
  readonly interactedToken: AppToken;
  readonly pendingActionType: YieldPendingActionType;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly requestDto: ManageActionCommand;
  readonly walletScope: WalletScopeKey;
};

export const pendingActionRequestAtom = Atom.make<PendingActionRequest | null>(
  null
).pipe(Atom.keepAlive, Atom.withLabel("pendingActionRequestAtom"));

export const pendingTransactionWorkflowLifecycleAtom =
  makeTransactionWorkflowLifecycleAtom(
    pendingActionRequestAtom,
    "pendingTransactionWorkflowLifecycleAtom"
  );

export const pendingTransactionWorkflowKeyAtom = selectAtom(
  pendingActionRequestAtom,
  (request): ClassicTransactionWorkflowKey | null =>
    request?.actionDto
      ? makeClassicTransactionWorkflowKey({
          action: request.actionDto,
          inputToken: request.interactedToken,
          providersDetails: request.providersDetails,
          walletScope: request.walletScope,
        })
      : null
);
