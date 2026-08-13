import { Cause, Effect, Match, Schedule, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { isBorrowNetwork } from "../../domain/borrow/network";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../services/events/widget-domain-events";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import {
  sameWalletScopeOwner,
  type WalletScopeOwnerKey,
} from "../../services/wallet/wallet-scope";
import { WalletService } from "../../services/wallet/wallet-service";
import type { WalletState } from "../../services/wallet/wallet-state";
import { walletRuntime } from "./wallet-runtime";

type TransactionWorkflowEnded = Extract<
  WidgetDomainEvent,
  { readonly _tag: "TransactionWorkflowEnded" }
>;

type TransactionWorkflowResourceInvalidation =
  | {
      readonly _tag: "Ended";
      readonly event: TransactionWorkflowEnded;
    }
  | {
      readonly _tag: "Reconciliation";
      readonly event: TransactionWorkflowEnded;
    };

const keysFor = (
  request: TransactionWorkflowResourceInvalidation
): ReadonlyArray<unknown> => {
  const owner = request.event.owner;
  return Match.valueTags(request, {
    Ended: ({ event }) => {
      if (event.workflowKind === "Classic") {
        return [
          ...resourceInvalidationKeys.walletBalances(owner),
          ...resourceInvalidationKeys.yieldPositions(owner),
          ...resourceInvalidationKeys.singleYieldBalances(owner.address),
          ...resourceInvalidationKeys.activity(owner),
        ];
      }

      return [
        ...resourceInvalidationKeys.walletBalances(owner),
        ...(isBorrowNetwork(owner.network)
          ? [
              ...resourceInvalidationKeys.borrowPositions(owner),
              ...resourceInvalidationKeys.borrowMarkets(owner.network),
            ]
          : []),
      ];
    },
    Reconciliation: ({ event }) => {
      if (event.workflowKind === "Classic") {
        return [
          ...resourceInvalidationKeys.walletBalances(owner),
          ...resourceInvalidationKeys.yieldPositions(owner),
          ...resourceInvalidationKeys.singleYieldBalances(owner.address),
        ];
      }

      return [
        ...resourceInvalidationKeys.walletBalances(owner),
        ...(isBorrowNetwork(owner.network)
          ? resourceInvalidationKeys.borrowPositions(owner)
          : []),
      ];
    },
  });
};

const RECONCILIATION_ROUND_COUNT = 4;
const RECONCILIATION_SCHEDULE = Schedule.spaced("10 seconds");

const isCurrentWalletScopeOwner = (
  state: WalletState,
  owner: WalletScopeOwnerKey
) =>
  state.connection.status === "connected" &&
  sameWalletScopeOwner(state.connection, owner);

export const transactionWorkflowResourceEventProjection = Stream.unwrap(
  Effect.gen(function* () {
    const domainEvents = yield* WidgetDomainEvents;
    const reactivity = yield* Reactivity.Reactivity;
    const wallet = yield* WalletService;

    const reportCause = (cause: Cause.Cause<unknown>) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.failCause(cause)
        : Effect.logError(
            "Transaction Workflow resource projection failed.",
            cause
          );

    const invalidate = (request: TransactionWorkflowResourceInvalidation) =>
      reactivity
        .withBatch(reactivity.invalidate(keysFor(request)))
        .pipe(Effect.catchCause(reportCause));

    return domainEvents.events.pipe(
      Stream.filter(
        (event): event is TransactionWorkflowEnded =>
          event._tag === "TransactionWorkflowEnded"
      ),
      Stream.tap((event) => invalidate({ _tag: "Ended", event })),
      Stream.filterEffect((event) =>
        wallet.state.pipe(
          Effect.map((state) => isCurrentWalletScopeOwner(state, event.owner)),
          Effect.catchCause((cause) =>
            reportCause(cause).pipe(Effect.as(false))
          )
        )
      ),
      Stream.switchMap((event) =>
        Stream.fromSchedule(RECONCILIATION_SCHEDULE).pipe(
          Stream.take(RECONCILIATION_ROUND_COUNT),
          Stream.mapEffect(() => invalidate({ _tag: "Reconciliation", event })),
          Stream.interruptWhen(
            wallet.states.pipe(
              Stream.filter(
                (state) => !isCurrentWalletScopeOwner(state, event.owner)
              ),
              Stream.take(1),
              Stream.runDrain,
              Effect.catchCause(reportCause)
            )
          )
        )
      )
    );
  })
);

export const transactionWorkflowResourceEventProjectionAtom = walletRuntime
  .atom(transactionWorkflowResourceEventProjection)
  .pipe(Atom.withLabel("transactionWorkflowResourceEventProjectionAtom"));
