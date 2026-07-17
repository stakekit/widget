import * as Atom from "effect/unstable/reactivity/Atom";
import { WalletScopeKey } from "../../../services/wallet/domain/scope";
import { BorrowTransactionWorkflowKey } from "../../../services/workflow/transaction-workflow-model";
import { selectAtom } from "../../../shared/effect/select-atom";
import { makeTransactionWorkflowLifecycleAtom } from "../../transaction-flow/state/workflow-lifecycle";
import { currentWalletScopeAtom } from "../../wallet";
import type { BorrowExecutionInput } from "./review-state";

export const borrowExecutionInputAtom = Atom.writable<
  BorrowExecutionInput | null,
  BorrowExecutionInput | null
>(
  (context) => {
    context.get(currentWalletScopeAtom);
    return null;
  },
  (context, input) => {
    context.setSelf(input);
  }
).pipe(Atom.keepAlive, Atom.withLabel("borrowExecutionInputAtom"));

export const borrowTransactionWorkflowLifecycleAtom =
  makeTransactionWorkflowLifecycleAtom(
    borrowExecutionInputAtom,
    "borrowTransactionWorkflowLifecycleAtom"
  );

export const borrowTransactionWorkflowKeyAtom = selectAtom(
  borrowExecutionInputAtom,
  (input): BorrowTransactionWorkflowKey | null =>
    input
      ? new BorrowTransactionWorkflowKey({
          action: input.action,
          walletScope: new WalletScopeKey({
            address: input.request.address,
            network: input.summary.network,
          }),
        })
      : null
);
