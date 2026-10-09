import { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { makeScopedEffectAtom } from "../../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type { BorrowFlowSession } from "../../model/borrow-transaction-flow";
import { borrowTransactionFlowServiceAtom } from "./borrow-flow";
import { makeBorrowFlowExecutionScopeAtom } from "./borrow-flow-execution";
import { makeBorrowFlowReviewScopeAtom } from "./borrow-flow-review";

/**
 * One mounted Flow Session. The flow route creates an instance per mount, so
 * the Session's operations live exactly as long as that Atom's Scope.
 */
export const makeBorrowFlowSessionModule = (session: BorrowFlowSession) =>
  makeScopedEffectAtom({
    acquire: (context) =>
      context
        .result(borrowTransactionFlowServiceAtom)
        .pipe(Effect.flatMap((service) => service.openSession(session))),
    label: "borrowFlowSessionScope",
    makeValue: (sessionAtom) => ({
      facade: { intake: session.intake },
      ports: {
        makeExecutionScopeAtom: () =>
          makeBorrowFlowExecutionScopeAtom(sessionAtom),
        makeReviewScopeAtom: () => makeBorrowFlowReviewScopeAtom(sessionAtom),
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
