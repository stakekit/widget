import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react";
import { Outlet, useLocation } from "react-router";
import { widgetRoutes } from "../../../services/navigation/widget-routes";
import { useWidgetRouteState } from "../../navigation/index";
import { WidgetNavigate } from "../../navigation/views";
import { walletScopeAtom } from "../../wallet/index";
import {
  getYieldTransactionFlowIntakeVariant,
  isYieldTransactionFlowWalletScopeValid,
  type YieldFlowMountTag,
  type YieldFlowSession,
  type YieldTransactionFlowIntake,
  yieldFlowRoutes,
} from "../model/yield-transaction-flow";
import { isYieldTransactionWorkflowFinished } from "../model/yield-transaction-workflow";
import {
  YieldFlowExecutionKey,
  yieldFlowExecutionPage,
} from "../state/execution-page";
import {
  YieldFlowReviewVisit,
  yieldFlowReviewPage,
} from "../state/review-page";

const YieldFlowSessionContext = createContext<YieldFlowSession | null>(null);

export const useYieldFlowSession = (): YieldFlowSession => {
  const session = useContext(YieldFlowSessionContext);
  if (!session) throw new Error("Yield Flow Session is unavailable.");
  return session;
};

/** This visit's Review: the same Atoms for every render of it. */
export const useYieldFlowReview = () =>
  useAtomValue(
    yieldFlowReviewPage(
      new YieldFlowReviewVisit({
        session: useYieldFlowSession(),
        visit: useLocation().key,
      })
    )
  );

/** The handoff Steps and Complete were navigated to run, if any. */
const useYieldFlowExecutionHandoff = () => {
  const session = useYieldFlowSession();
  return (
    useWidgetRouteState(yieldFlowRoutes[session.mount._tag])
      ?.executionHandoff ?? null
  );
};

/** The Execution of the handoff Steps and Complete were navigated to run. */
export const useYieldFlowExecution = () => {
  const handoff = useYieldFlowExecutionHandoff();
  const session = useYieldFlowSession();
  if (!handoff) throw new Error("Yield Flow Execution is unavailable.");
  return useAtomValue(
    yieldFlowExecutionPage(new YieldFlowExecutionKey({ handoff, session }))
  );
};

export const useYieldFlowIntake = <
  Variant extends YieldTransactionFlowIntake["_tag"],
>(
  variant: Variant
): Extract<YieldTransactionFlowIntake, { readonly _tag: Variant }> => {
  const intake = getYieldTransactionFlowIntakeVariant(
    useYieldFlowSession().intake,
    variant
  );
  if (!intake) throw new Error(`Expected Yield Flow ${variant} intake.`);
  return intake;
};

type MountedYieldFlowSession = Readonly<{
  /** The location that delivered the Session; remounts the Session subtree. */
  readonly key: string;
  readonly session: YieldFlowSession;
}>;

/**
 * Holds the Flow Session it was navigated to while this route stays mounted.
 * A Start that navigates here again carries a new Session, which replaces it.
 */
export const YieldFlowRoute = ({
  expected,
  mount,
}: {
  readonly expected: Exclude<
    YieldTransactionFlowIntake["_tag"],
    "YieldActionContinuation"
  >;
  readonly mount: Exclude<YieldFlowMountTag, "YieldActionContinuation">;
}) => {
  const location = useLocation();
  const navigated =
    useWidgetRouteState(yieldFlowRoutes[mount])?.yieldFlowSession ?? null;
  const [mounted, setMounted] = useState<MountedYieldFlowSession | null>(null);
  if (navigated && navigated !== mounted?.session) {
    setMounted({ key: location.key, session: navigated });
    return null;
  }
  if (
    !mounted ||
    !getYieldTransactionFlowIntakeVariant(mounted.session.intake, expected)
  ) {
    return <WidgetNavigate replace to={widgetRoutes.earn.build()} />;
  }
  return <YieldFlowSessionRoute key={mounted.key} session={mounted.session} />;
};

/** Provides `session` to its pages while the connected wallet owns it. */
export const YieldFlowSessionRoute = ({
  session,
}: {
  readonly session: YieldFlowSession;
}) => {
  const walletScope = useAtomValue(walletScopeAtom);
  if (!isYieldTransactionFlowWalletScopeValid(session.intake, walletScope)) {
    return <WidgetNavigate replace to={widgetRoutes.earn.build()} />;
  }
  return (
    <YieldFlowSessionContext.Provider value={session}>
      <Outlet />
    </YieldFlowSessionContext.Provider>
  );
};

/**
 * Shows Steps and Complete while their Execution runs. Leaving both ends its
 * workflow; without an action handed off by Review, it leaves the flow.
 */
export const YieldFlowExecutionRoute = ({ children }: PropsWithChildren) => {
  const handoff = useYieldFlowExecutionHandoff();
  if (!handoff) {
    return <WidgetNavigate replace to={widgetRoutes.earn.build()} />;
  }
  return <ExecutionStarted>{children}</ExecutionStarted>;
};

// A handoff that cannot start, or whose workflow input proves invalid after
// its confidential steps, leaves the flow.
const ExecutionStarted = ({ children }: PropsWithChildren) => {
  const { executionAtom, stateAtom } = useYieldFlowExecution();
  const execution = useAtomValue(executionAtom);
  const state = useAtomValue(stateAtom);
  if (AsyncResult.isFailure(execution) || AsyncResult.isFailure(state)) {
    return <WidgetNavigate replace to={widgetRoutes.earn.build()} />;
  }
  if (AsyncResult.isInitial(execution)) return null;
  return children ?? <Outlet />;
};

/** Steps until the workflow finishes, then Complete, on the same Execution. */
export const YieldFlowExecutionPage = ({
  children,
  page,
}: PropsWithChildren<{ readonly page: "Complete" | "Steps" }>) => {
  const session = useYieldFlowSession();
  const handoff = useYieldFlowExecutionHandoff();
  const state = useAtomValue(useYieldFlowExecution().stateAtom);
  // Confidential steps run before the workflow has a state.
  const finished =
    AsyncResult.isSuccess(state) &&
    isYieldTransactionWorkflowFinished(state.value);
  const navigationState = {
    ...(handoff ? { executionHandoff: handoff } : {}),
    yieldFlowSession: session,
  };
  if (page === "Steps" && finished) {
    return (
      <WidgetNavigate
        replace
        to={session.destination.complete(navigationState)}
      />
    );
  }
  if (page === "Complete" && !finished) {
    return (
      <WidgetNavigate replace to={session.destination.steps(navigationState)} />
    );
  }
  return children ?? <Outlet />;
};
