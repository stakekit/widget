import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

export type BorrowTransactionFlowOutcome = Readonly<{
  readonly epoch: number;
  readonly _tag: "Done" | "ExecutionStarted";
}>;

const outcomeStateAtom = Atom.make<Option.Option<BorrowTransactionFlowOutcome>>(
  Option.none()
).pipe(Atom.keepAlive, Atom.withLabel("borrowTransactionFlowOutcomeState"));

export const borrowTransactionFlowOutcomeAtom = Atom.make((get) =>
  get(outcomeStateAtom)
).pipe(Atom.withLabel("borrowTransactionFlowOutcome"));

export const publishBorrowTransactionFlowOutcomeAtom = Atom.fnSync(
  (outcome: BorrowTransactionFlowOutcome, context) => {
    context.set(outcomeStateAtom, Option.some(outcome));
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("publishBorrowTransactionFlowOutcome"));
