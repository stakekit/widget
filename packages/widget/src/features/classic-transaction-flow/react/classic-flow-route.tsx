import { make as makeScopedAtom, useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import { type PropsWithChildren, useContext } from "react";
import { Navigate, Outlet } from "react-router";
import { useWidgetConfig } from "../../../app/config/use-widget-config";
import type { YieldAction } from "../../../domain/schema/action-models";
import { useWalletScopeRoute } from "../../wallet/react/wallet-scope-route";
import {
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowIntakeVariant,
  isClassicTransactionFlowWalletScopeValid,
} from "../model/classic-transaction-flow";
import { classicFlowSessionStore } from "../session";
import {
  type ClassicFlowExecutionFacade,
  type ClassicFlowReviewFacade,
  type ClassicFlowSessionFacade,
  type ClassicFlowSessionModule,
  makeClassicFlowExecutionScope,
  makeClassicFlowReviewScope,
  makeClassicFlowSessionModule,
} from "../state/classic-flow-session-facade";

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

const ClassicFlowRoute = ({
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

export const EnterClassicFlowRoute = () => (
  <ClassicFlowRoute expected="Enter" />
);
export const ExitClassicFlowRoute = () => <ClassicFlowRoute expected="Exit" />;
export const ManageClassicFlowRoute = () => (
  <ClassicFlowRoute expected="Manage" />
);
export const ActivityResumeClassicFlowRoute = () => (
  <ClassicFlowRoute expected="ActivityResume" />
);

export const ClassicFlowReviewScope = ({ children }: PropsWithChildren) => {
  const session = useClassicFlowSessionModule();

  return (
    <ReviewScopedAtom.Provider value={session}>
      <ReviewBinding>{children}</ReviewBinding>
    </ReviewScopedAtom.Provider>
  );
};

const getActivityStepsPath = (action: YieldAction) => {
  const path = Match.value(action.type).pipe(
    Match.when("UNSTAKE", () => "unstake"),
    Match.when("STAKE", () => "stake"),
    Match.orElse(() => "pending")
  );
  return `/activity/${path}/steps`;
};

const ReviewBinding = ({ children }: PropsWithChildren) => {
  const session = useClassicFlowSession();
  const review = useClassicFlowReview();
  const view = useAtomValue(review.reviewViewAtom);
  const navigation = useAtomValue(review.navigationAtom);
  const to =
    session.intake._tag === "ActivityResume" && view.action
      ? getActivityStepsPath(view.action)
      : "../steps";

  return (
    <>
      {navigation === "Steps" ? <Navigate to={to} relative="path" /> : null}
      {children ?? <Outlet />}
    </>
  );
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
  const dashboardVariant = useWidgetConfig("dashboardVariant");

  if (!execution) return <Navigate to="/" replace />;

  return (
    <>
      <ExecutionNavigation dashboardVariant={dashboardVariant} />
      {children ?? <Outlet />}
    </>
  );
};

const ExecutionNavigation = ({
  dashboardVariant,
}: {
  readonly dashboardVariant: boolean | undefined;
}) => {
  const { navigationAtom } = useClassicFlowExecution();
  const intake = useClassicFlowSession().intake;
  const navigation = useAtomValue(navigationAtom);
  const to = Match.value(intake).pipe(
    Match.tag("ActivityResume", () =>
      dashboardVariant ? "../.." : "../../review"
    ),
    Match.orElse(() => "../review")
  );

  if (navigation === "Review") {
    return <Navigate to={to} relative="path" replace />;
  }

  return null;
};
