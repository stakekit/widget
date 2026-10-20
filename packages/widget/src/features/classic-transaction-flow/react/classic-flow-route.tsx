import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { walletScopeAtom } from "../../wallet/index";
import {
  type ClassicFlowSession,
  type ClassicTransactionFlowIntake,
  decodeClassicFlowExecutionHandoff,
  decodeClassicFlowNavigationState,
  getClassicTransactionFlowIntakeVariant,
  isClassicTransactionFlowWalletScopeValid,
} from "../model/classic-transaction-flow";
import { isClassicTransactionWorkflowFinished } from "../model/classic-transaction-workflow";
import {
  ClassicFlowExecutionKey,
  classicFlowExecutionPage,
} from "../state/execution-page";
import {
  ClassicFlowReviewVisit,
  classicFlowReviewPage,
} from "../state/review-page";

const ClassicFlowSessionContext = createContext<ClassicFlowSession | null>(
  null
);

export const useClassicFlowSession = (): ClassicFlowSession => {
  const session = useContext(ClassicFlowSessionContext);
  if (!session) throw new Error("Classic Flow Session is unavailable.");
  return session;
};

/** This visit's Review: the same Atoms for every render of it. */
export const useClassicFlowReview = () =>
  useAtomValue(
    classicFlowReviewPage(
      new ClassicFlowReviewVisit({
        session: useClassicFlowSession(),
        visit: useLocation().key,
      })
    )
  );

/** The Execution of the handoff Steps and Complete were navigated to run. */
export const useClassicFlowExecution = () => {
  const handoff = decodeClassicFlowExecutionHandoff(useLocation().state);
  const session = useClassicFlowSession();
  if (!handoff) throw new Error("Classic Flow Execution is unavailable.");
  return useAtomValue(
    classicFlowExecutionPage(new ClassicFlowExecutionKey({ handoff, session }))
  );
};

export const useClassicFlowIntake = <
  Variant extends ClassicTransactionFlowIntake["_tag"],
>(
  variant: Variant
): Extract<ClassicTransactionFlowIntake, { readonly _tag: Variant }> => {
  const intake = getClassicTransactionFlowIntakeVariant(
    useClassicFlowSession().intake,
    variant
  );
  if (!intake) throw new Error(`Expected Classic Flow ${variant} intake.`);
  return intake;
};

type MountedClassicFlowSession = Readonly<{
  /** The location that delivered the Session; remounts the Session subtree. */
  readonly key: string;
  readonly session: ClassicFlowSession;
}>;

/**
 * Holds the Flow Session it was navigated to while this route stays mounted.
 * A Start that navigates here again carries a new Session, which replaces it.
 */
export const ClassicFlowRoute = ({
  expected,
}: {
  readonly expected: Exclude<
    ClassicTransactionFlowIntake["_tag"],
    "YieldActionContinuation"
  >;
}) => {
  const location = useLocation();
  const navigated = Option.getOrNull(
    decodeClassicFlowNavigationState(location.state)
  );
  const [mounted, setMounted] = useState<MountedClassicFlowSession | null>(
    null
  );
  if (navigated && navigated !== mounted?.session) {
    setMounted({ key: location.key, session: navigated });
    return null;
  }
  if (
    !mounted ||
    !getClassicTransactionFlowIntakeVariant(mounted.session.intake, expected)
  ) {
    return <Navigate to="/" replace />;
  }
  return (
    <ClassicFlowSessionRoute key={mounted.key} session={mounted.session} />
  );
};

/** Provides `session` to its pages while the connected wallet owns it. */
export const ClassicFlowSessionRoute = ({
  session,
}: {
  readonly session: ClassicFlowSession;
}) => {
  const walletScope = useAtomValue(walletScopeAtom);
  if (!isClassicTransactionFlowWalletScopeValid(session.intake, walletScope)) {
    return <Navigate to="/" replace />;
  }
  return (
    <ClassicFlowSessionContext.Provider value={session}>
      <Outlet />
    </ClassicFlowSessionContext.Provider>
  );
};

/**
 * Shows Steps and Complete while their Execution runs. Leaving both ends its
 * workflow; without an action handed off by Review, it leaves the flow.
 */
export const ClassicFlowExecutionRoute = ({ children }: PropsWithChildren) => {
  const handoff = decodeClassicFlowExecutionHandoff(useLocation().state);
  if (!handoff) return <Navigate to="/" replace />;
  return <ExecutionStarted>{children}</ExecutionStarted>;
};

// A handoff that cannot start, or whose workflow input proves invalid after
// its confidential steps, leaves the flow.
const ExecutionStarted = ({ children }: PropsWithChildren) => {
  const { executionAtom, stateAtom } = useClassicFlowExecution();
  const execution = useAtomValue(executionAtom);
  const state = useAtomValue(stateAtom);
  if (AsyncResult.isFailure(execution) || AsyncResult.isFailure(state)) {
    return <Navigate to="/" replace />;
  }
  if (AsyncResult.isInitial(execution)) return null;
  return children ?? <Outlet />;
};

/** Steps until the workflow finishes, then Complete, on the same Execution. */
export const ClassicFlowExecutionPage = ({
  children,
  page,
}: PropsWithChildren<{ readonly page: "Complete" | "Steps" }>) => {
  const { destination } = useClassicFlowSession();
  const location = useLocation();
  const state = useAtomValue(useClassicFlowExecution().stateAtom);
  // Confidential steps run before the workflow has a state.
  const finished =
    AsyncResult.isSuccess(state) &&
    isClassicTransactionWorkflowFinished(state.value);
  if (page === "Steps" && finished) {
    return (
      <Navigate replace state={location.state} to={destination.completePath} />
    );
  }
  if (page === "Complete" && !finished) {
    return (
      <Navigate replace state={location.state} to={destination.stepsPath} />
    );
  }
  return children ?? <Outlet />;
};
