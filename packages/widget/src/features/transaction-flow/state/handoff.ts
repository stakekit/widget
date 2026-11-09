import { Effect, Ref, type Scope } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type {
  TransactionWorkflowInput,
  TransactionWorkflowInputError,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  type TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../services/transaction-workflow/transaction-workflow-service";
import { afterCurrentRender } from "../../../shared/effect/after-render";

/**
 * The Handoff a Flow Session holds, at most one: waiting for Steps to start
 * it, then running until its Execution ends. Each flow adds what it hands off.
 */
type TransactionFlowHandoff = Readonly<{
  readonly _tag: "Running" | "Waiting";
}>;

/** The Session's slot for its Handoff; null while it holds none. */
type HandoffSlot<H extends TransactionFlowHandoff> = Ref.Ref<H | null>;

export type TransactionFlowHandoffOutcome =
  | Readonly<{ readonly _tag: "Confirmed" }>
  | Readonly<{ readonly _tag: "RejectedConfirmed" }>;

/**
 * Hands `waiting` to the Execution Steps opens, once: while the Session holds
 * a Handoff, another is rejected. `navigate` opens Steps, with whatever runs
 * alongside it; if it fails, the Handoff is released, since a Steps that never
 * opened cannot start it and confirming again must. Both run together, so an
 * interrupted confirmation still lands on Steps holding its Handoff.
 */
export const handOffTransactionFlow = <H extends TransactionFlowHandoff, E, R>(
  slot: HandoffSlot<H>,
  waiting: NoInfer<H> & { readonly _tag: "Waiting" },
  navigate: Effect.Effect<unknown, E, R>
): Effect.Effect<TransactionFlowHandoffOutcome, E, R> =>
  Effect.uninterruptible(
    Effect.gen(function* () {
      const held = yield* Ref.getAndUpdate(
        slot,
        (current) => current ?? waiting
      );
      if (held) return { _tag: "RejectedConfirmed" } as const;
      yield* navigate.pipe(
        Effect.tapError(() =>
          Ref.update(slot, (current) => (current === waiting ? null : current))
        )
      );
      return { _tag: "Confirmed" } as const;
    })
  );

/**
 * Starts the workflow for the Handoff `isHandoff` names, in the caller's
 * Scope, if it is waiting in the Session: it is marked running and held until
 * the Scope closes, so Review cannot hand off another meanwhile. Once it has
 * started, a remount, history navigation, or link to Steps finds nothing
 * waiting and is interrupted.
 */
export const startTransactionFlowExecution = <H extends TransactionFlowHandoff>(
  slot: HandoffSlot<H>,
  isHandoff: (waiting: H) => boolean,
  makeInput: (handoff: H) => TransactionWorkflowInput
): Effect.Effect<
  TransactionWorkflowHandle,
  TransactionWorkflowInputError,
  Scope.Scope | TransactionWorkflowService
> =>
  Effect.gen(function* () {
    const handoff = yield* Effect.acquireRelease(
      Ref.modify(slot, (current): readonly [H | null, H | null] =>
        current?._tag === "Waiting" && isHandoff(current)
          ? [current, { ...current, _tag: "Running" as const }]
          : [null, current]
      ),
      (started) => (started ? Ref.set(slot, null) : Effect.void)
    );
    if (!handoff) return yield* Effect.interrupt;

    // Steps first reads this Atom while React renders.
    yield* afterCurrentRender;
    const workflows = yield* TransactionWorkflowService;
    return yield* workflows.make(makeInput(handoff));
  });

/**
 * One Review visit's page model, behind an Atom that, on arrival, releases a
 * Handoff still waiting for a Steps that never started it, so confirming
 * again hands off a new one. A Handoff already running stays held until its
 * Execution ends.
 *
 * The model lives in an Atom: a family holds its values only weakly, so the
 * subscribed Atom is what keeps the model alive.
 */
export const makeTransactionFlowReviewPage = <
  H extends TransactionFlowHandoff,
  Page,
>(
  slot: HandoffSlot<H>,
  page: Page
): Atom.Atom<Page> => {
  const arrivalAtom = Atom.make(
    Ref.update(slot, (current) =>
      current?._tag === "Waiting" ? null : current
    )
  );
  return Atom.readable((get) => {
    get(arrivalAtom);
    return page;
  });
};
