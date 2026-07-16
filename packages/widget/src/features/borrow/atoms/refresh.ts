import { Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import { type Action, isBorrowNetwork } from "../../../domain/borrow";
import {
  tokenBalancesScanResourceAtom,
  yieldBalancesScanResourceAtom,
} from "../../../features/portfolio";
import { getTransactionWorkflowAtoms } from "../../../features/transaction-flow/state/transaction-workflow-atoms";
import type { NormalizedWalletState } from "../../../features/wallet";
import { WalletService } from "../../../services/wallet/wallet-service";
import type {
  BorrowTransactionWorkflowKey,
  TransactionWorkflowEvent,
} from "../../../services/workflow/transaction-workflow-model";
import { refreshAtomResources } from "../../../shared/effect/api-resource";
import {
  BorrowMarketsKey,
  BorrowPositionsKey,
  borrowIntegrationsAtom,
  borrowMarketsAtom,
  borrowPositionsAtom,
} from "./resources";

const getBorrowEventAction = (
  event: TransactionWorkflowEvent
): Action | null => {
  if (
    event._tag === "TransactionWorkflowSigned" ||
    event.context.domain._tag !== "Borrow"
  ) {
    return null;
  }

  return event.context.domain.action;
};

const getBorrowRefreshNetwork = (event: TransactionWorkflowEvent) => {
  const action = getBorrowEventAction(event);
  const network =
    event._tag === "TransactionWorkflowSubmitted" &&
    event.submission.source._tag === "Borrow"
      ? event.submission.source.transaction.network
      : action?.transactions[0]?.network;

  return network && isBorrowNetwork(network) ? network : null;
};

export const getBorrowExecutionRefreshResources = (
  event: TransactionWorkflowEvent,
  walletState: NormalizedWalletState
): ReadonlyArray<Atom.Atom<unknown>> => {
  const action = getBorrowEventAction(event);

  if (!action) return [];

  const network = getBorrowRefreshNetwork(event);
  const resources: Array<Atom.Atom<unknown>> = [borrowIntegrationsAtom];

  if (!network) return resources;

  resources.push(borrowMarketsAtom(new BorrowMarketsKey({ network })));
  resources.push(
    borrowPositionsAtom(
      new BorrowPositionsKey({
        address: action.address,
        network,
      })
    )
  );

  if (
    walletState.status === "connected" &&
    walletState.address === action.address &&
    walletState.network === network
  ) {
    resources.push(
      tokenBalancesScanResourceAtom,
      yieldBalancesScanResourceAtom
    );
  }

  return resources;
};

export const borrowExecutionRefreshAtom = Atom.family(
  (key: BorrowTransactionWorkflowKey) => {
    const machineAtom = getTransactionWorkflowAtoms(key).machineAtom;

    return appRuntime.atom(
      (context) =>
        Effect.all([context.result(machineAtom), WalletService]).pipe(
          Effect.map(([machine, wallet]) =>
            machine.events.pipe(
              Stream.filter(
                (event) =>
                  event._tag === "TransactionWorkflowSubmitted" ||
                  event._tag === "TransactionWorkflowCompleted"
              ),
              Stream.tap((event) =>
                Effect.sync(() =>
                  refreshAtomResources(
                    context,
                    getBorrowExecutionRefreshResources(event, wallet.getState())
                  )
                )
              ),
              Stream.map(() => undefined)
            )
          ),
          Stream.unwrap
        ),
      { initialValue: undefined }
    );
  }
);
