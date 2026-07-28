import { make as makeScopedAtom, useAtomValue } from "@effect/atom-react";
import { type PropsWithChildren, useContext } from "react";
import { Navigate, Outlet } from "react-router";
import { useWalletScopeRoute } from "../../wallet/ui";
import {
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowIntakeVariant,
  isClassicTransactionFlowWalletScopeValid,
} from "../model/classic-transaction-flow";
import {
  type ClassicFlowExecutionFacade,
  type ClassicFlowReviewFacade,
  type ClassicFlowSessionFacade,
  type ClassicFlowSessionModule,
  makeClassicFlowExecutionScope,
  makeClassicFlowReviewScope,
  makeClassicFlowSessionModule,
} from "../state/classic-flow-session-facade";
import { classicFlowSessionStore } from "../state/flow-session-store";

const SessionScopedAtom = makeScopedAtom(makeClassicFlowSessionModule);

const useClassicFlowSessionModule = (): ClassicFlowSessionModule => {
  const rootAtom = useContext(SessionScopedAtom.Context);
  return useAtomValue(rootAtom);
};

export const useClassicFlowSession = (): ClassicFlowSessionFacade => {
  const session = useClassicFlowSessionModule();
  return session.facade;
};

const ReviewScopedAtom = makeScopedAtom((session: ClassicFlowSessionModule) =>
  makeClassicFlowReviewScope(session)
);

export const useClassicFlowReview = (): ClassicFlowReviewFacade => {
  const reviewAtom = useContext(ReviewScopedAtom.Context);
  return useAtomValue(reviewAtom);
};

const ExecutionScopedAtom = makeScopedAtom(
  (session: ClassicFlowSessionModule) => makeClassicFlowExecutionScope(session)
);

export const useClassicFlowExecution = (): ClassicFlowExecutionFacade => {
  const executionAtom = useContext(ExecutionScopedAtom.Context);
  const execution = useAtomValue(executionAtom);
  if (!execution) throw new Error("Classic Flow Execution is unavailable.");
  return execution;
};

export const useClassicFlowIntake = <
  Variant extends ClassicTransactionFlowIntake["_tag"],
>(
  variant: Variant
): Extract<ClassicTransactionFlowIntake, { readonly _tag: Variant }> => {
  const session = useClassicFlowSession();
  return session.getIntake(variant);
};

export const ClassicFlowRoute = ({
  expected,
}: {
  readonly expected: ClassicTransactionFlowIntake["_tag"];
}) => {
  const session = useAtomValue(classicFlowSessionStore.currentSessionAtom);
  const walletScope = useWalletScopeRoute();
  const intake = session
    ? getClassicTransactionFlowIntakeVariant(session.intake, expected)
    : null;

  if (
    session &&
    intake &&
    isClassicTransactionFlowWalletScopeValid(intake, walletScope)
  ) {
    return (
      <SessionScopedAtom.Provider key={session.epoch} value={session}>
        <SessionBinding />
      </SessionScopedAtom.Provider>
    );
  }

  return <Navigate to="/" replace />;
};

const SessionBinding = () => {
  useClassicFlowSessionModule();
  return <Outlet />;
};

export const ClassicFlowReviewScope = ({ children }: PropsWithChildren) => {
  const session = useClassicFlowSessionModule();

  return (
    <ReviewScopedAtom.Provider value={session}>
      <ReviewBinding>{children}</ReviewBinding>
    </ReviewScopedAtom.Provider>
  );
};

const ReviewBinding = ({ children }: PropsWithChildren) => {
  useClassicFlowReview();
  return children ?? <Outlet />;
};

export const ClassicFlowExecutionScope = ({ children }: PropsWithChildren) => {
  const session = useClassicFlowSessionModule();

  return (
    <ExecutionScopedAtom.Provider value={session}>
      <ExecutionBinding>{children}</ExecutionBinding>
    </ExecutionScopedAtom.Provider>
  );
};

const ExecutionBinding = ({ children }: PropsWithChildren) => {
  const executionAtom = useContext(ExecutionScopedAtom.Context);
  const execution = useAtomValue(executionAtom);
  if (!execution) return <Navigate to="/" replace />;

  return children ?? <Outlet />;
};
