import { Effect, Stream } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { isBorrowNetwork } from "../domain";
import type { BorrowExecutionEvent } from "../runtime";
import { BorrowExecutionEventsService, borrowAtomRuntime } from "../runtime";
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

const refreshBorrowResources = ({
  context,
  event,
}: {
  readonly context: Atom.AtomContext;
  readonly event: BorrowExecutionEvent;
}) => {
  const network = getBorrowRefreshNetwork(event);

  context.refresh(borrowIntegrationsAtom);

  if (!network) {
    return;
  }

  context.refresh(borrowMarketsAtom(new BorrowMarketsKey({ network })));
  context.refresh(
    borrowPositionsAtom(
      new BorrowPositionsKey({
        address: event.action.address,
        network,
      })
    )
  );
};

export const borrowExecutionEventsAtom = borrowAtomRuntime.atom(() =>
  Stream.fromEffect(BorrowExecutionEventsService).pipe(
    Stream.flatMap((events) => events.events)
  )
);

export const borrowExecutionRuntimeRefreshAtom = borrowAtomRuntime.atom(
  (context) =>
    Stream.fromEffect(BorrowExecutionEventsService).pipe(
      Stream.flatMap((events) => events.events),
      Stream.tap((event) =>
        Effect.sync(() => refreshBorrowResources({ context, event }))
      ),
      Stream.map(() => undefined)
    ),
  { initialValue: undefined }
);
