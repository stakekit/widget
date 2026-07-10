import { Effect, Option, Schema, Stream } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { invalidateAtomResources } from "../../atoms/api-resource";
import {
  TokenBalanceScanCommand,
  YieldBalancesCommand,
} from "../../domain/schema/financial-models";
import {
  TokenBalancesKey,
  tokenBalancesAtom,
} from "../../hooks/api/token-balances-atoms";
import {
  YieldBalancesKey,
  yieldBalancesAtom,
} from "../../hooks/api/yield-balances-atoms";
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

export const getBorrowExecutionRefreshResources = (
  event: BorrowExecutionEvent
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

  const tokenCommand = Schema.decodeUnknownOption(TokenBalanceScanCommand)({
    addresses: { address: event.action.address },
    network,
  }).pipe(Option.getOrNull);
  const yieldCommand = Schema.decodeUnknownOption(YieldBalancesCommand)({
    queries: [{ address: event.action.address, network }],
  }).pipe(Option.getOrNull);

  if (tokenCommand) {
    resources.push(
      tokenBalancesAtom(
        new TokenBalancesKey({ command: tokenCommand, enabled: true })
      )
    );
  }

  if (yieldCommand) {
    resources.push(
      yieldBalancesAtom(
        new YieldBalancesKey({ command: yieldCommand, enabled: true })
      )
    );
  }

  return resources;
};

export const borrowExecutionRuntimeRefreshAtom = borrowAtomRuntime.atom(
  (context) =>
    Stream.fromEffect(BorrowExecutionEventsService).pipe(
      Stream.flatMap((events) => events.events),
      Stream.tap((event) =>
        Effect.sync(() =>
          invalidateAtomResources(
            context,
            getBorrowExecutionRefreshResources(event)
          )
        )
      ),
      Stream.map(() => undefined)
    ),
  { initialValue: undefined }
);
