import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  type BorrowTransactionFlowOutcome,
  borrowTransactionFlowOutcomeAtom,
} from "../../borrow-transaction-flow/state";
import { borrowActionFormAtom } from "./action-form";
import { currentBorrowDashboardAtom } from "./form";

const outcomeRank = (outcome: BorrowTransactionFlowOutcome) =>
  outcome._tag === "ExecutionStarted" ? 1 : 2;

const lastObservedOutcomeAtom = Atom.make<
  Readonly<{ readonly epoch: number; readonly rank: number }>
>({ epoch: 0, rank: 0 }).pipe(Atom.keepAlive);

export const borrowTransactionFlowOutcomeBindingAtom = Atom.make((context) => {
  const registry = context.registry;
  context.subscribe(
    borrowTransactionFlowOutcomeAtom,
    Option.match({
      onNone: () => undefined,
      onSome: (outcome) => {
        const rank = outcomeRank(outcome);
        const observed = registry.get(lastObservedOutcomeAtom);
        if (
          outcome.epoch < observed.epoch ||
          (outcome.epoch === observed.epoch && rank <= observed.rank)
        ) {
          return;
        }

        registry.set(lastObservedOutcomeAtom, { epoch: outcome.epoch, rank });
        registry.set(borrowActionFormAtom, { type: "reset" });
        if (outcome._tag === "Done") {
          registry.set(currentBorrowDashboardAtom, { type: "reset" });
        }
      },
    }),
    { immediate: true }
  );
}).pipe(Atom.withLabel("borrowTransactionFlowOutcomeBinding"));
