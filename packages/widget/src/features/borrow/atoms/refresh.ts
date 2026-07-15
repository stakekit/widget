import { Effect, Stream } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import { isBorrowNetwork } from "../../../domain/borrow";
import {
  tokenBalancesScanResourceAtom,
  yieldBalancesScanResourceAtom,
} from "../../../features/portfolio";
import type { NormalizedWalletState } from "../../../features/wallet";
import {
  type BorrowExecutionEvent,
  BorrowExecutionEventsService,
} from "../../../services/borrow/transaction-execution";
import { WalletService } from "../../../services/wallet/wallet-service";
import { refreshAtomResources } from "../../../shared/effect/api-resource";
import {
  BorrowMarketsKey,
  BorrowPositionsKey,
  borrowIntegrationsAtom,
  borrowMarketsAtom,
  borrowPositionsAtom,
} from "./resources";

const getBorrowRefreshNetwork = (event: BorrowExecutionEvent) => {
  const network =
    event._tag === "BorrowTransactionSubmitted"
      ? event.transaction.network
      : event.action.transactions[0]?.network;

  return network && isBorrowNetwork(network) ? network : null;
};

export const getBorrowExecutionRefreshResources = (
  event: BorrowExecutionEvent,
  walletState: NormalizedWalletState
): ReadonlyArray<Atom.Atom<unknown>> => {
  const network = getBorrowRefreshNetwork(event);

  const resources: Array<Atom.Atom<unknown>> = [borrowIntegrationsAtom];

  if (!network) return resources;

  resources.push(borrowMarketsAtom(new BorrowMarketsKey({ network })));
  resources.push(
    borrowPositionsAtom(
      new BorrowPositionsKey({
        address: event.action.address,
        network,
      })
    )
  );

  if (
    walletState.status === "connected" &&
    walletState.address === event.action.address &&
    walletState.network === network
  ) {
    resources.push(
      tokenBalancesScanResourceAtom,
      yieldBalancesScanResourceAtom
    );
  }

  return resources;
};

export const borrowExecutionRuntimeRefreshAtom = appRuntime.atom(
  (context) =>
    Stream.fromEffect(
      Effect.all([BorrowExecutionEventsService, WalletService])
    ).pipe(
      Stream.flatMap(([events, wallet]) =>
        events.events.pipe(
          Stream.map((event) => [event, wallet.getState()] as const)
        )
      ),
      Stream.tap(([event, walletState]) =>
        Effect.sync(() =>
          refreshAtomResources(
            context,
            getBorrowExecutionRefreshResources(event, walletState)
          )
        )
      ),
      Stream.map(() => undefined)
    ),
  { initialValue: undefined }
);
