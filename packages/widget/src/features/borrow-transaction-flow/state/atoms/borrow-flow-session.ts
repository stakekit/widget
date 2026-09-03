import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { makeScopedEffectAtom } from "../../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type { BorrowFlowSession } from "../../model/borrow-transaction-flow";
import {
  borrowTransactionFlowServiceAtom,
  currentBorrowFlowSessionAtom,
} from "./borrow-flow";
import { makeBorrowFlowExecutionScopeAtom } from "./borrow-flow-execution";
import { makeBorrowFlowReviewScopeAtom } from "./borrow-flow-review";

const makeBorrowFlowSessionModule = (session: BorrowFlowSession) =>
  makeScopedEffectAtom({
    acquire: (context) =>
      context
        .result(borrowTransactionFlowServiceAtom)
        .pipe(Effect.flatMap((service) => service.acquireSession(session))),
    label: "borrowFlowSessionScope",
    makeValue: (sessionOutcomeAtom) => ({
      facade: { intake: session.intake },
      ports: {
        makeExecutionScopeAtom: () =>
          makeBorrowFlowExecutionScopeAtom(sessionOutcomeAtom),
        makeReviewScopeAtom: () =>
          makeBorrowFlowReviewScopeAtom(sessionOutcomeAtom),
      },
    }),
    runtime: walletRuntime,
  });

export type BorrowFlowSessionModule = Atom.Type<
  ReturnType<typeof makeBorrowFlowSessionModule>
>;
export type BorrowFlowSessionFacade = BorrowFlowSessionModule["facade"];

export const makeBorrowFlowReviewScope = (session: BorrowFlowSessionModule) =>
  session.ports.makeReviewScopeAtom();
export const makeBorrowFlowExecutionScope = (
  session: BorrowFlowSessionModule
) => session.ports.makeExecutionScopeAtom();

type BorrowFlowReviewModule = Atom.Type<
  ReturnType<typeof makeBorrowFlowReviewScope>
>;
export type BorrowFlowReviewFacade = BorrowFlowReviewModule["facade"];
type BorrowFlowExecutionModule = Atom.Type<
  ReturnType<typeof makeBorrowFlowExecutionScope>
>;
export type BorrowFlowExecutionFacade = BorrowFlowExecutionModule["facade"];

const borrowFlowSessionRootAtomFamily = Atom.family(
  makeBorrowFlowSessionModule
);

export const currentBorrowFlowSessionRootAtom = Atom.make((get) => {
  const session = get(currentBorrowFlowSessionAtom);
  return session ? borrowFlowSessionRootAtomFamily(session) : null;
}).pipe(Atom.withLabel("currentBorrowFlowSessionRootAtom"));
