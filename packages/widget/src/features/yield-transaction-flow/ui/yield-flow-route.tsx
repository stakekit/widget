import { useAtomValue } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import { Outlet } from "react-router";

import { widgetRoutes } from "../../../services/navigation/widget-routes";
import { useWidgetRouteState } from "../../navigation/index";
import { WidgetNavigate } from "../../navigation/views";
import {
  TransactionFlowExecutionPage,
  TransactionFlowSessionMount,
} from "../../transaction-flow/views";
import { walletScopeAtom } from "../../wallet/index";
import {
  getYieldTransactionFlowIntakeVariant,
  isYieldTransactionFlowWalletScopeValid,
  type YieldTransactionFlowIntake,
} from "../model/intake";
import {
  type YieldFlowMountTag,
  type YieldFlowSession,
  yieldFlowRoutes,
} from "../model/session";
import {
  useYieldFlowExecution,
  useYieldFlowExecutionHandoff,
  useYieldFlowSession,
  YieldFlowSessionContext,
} from "./yield-flow-session";

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
  const navigated =
    useWidgetRouteState(yieldFlowRoutes[mount])?.yieldFlowSession ?? null;
  return (
    <TransactionFlowSessionMount
      accepts={(session) =>
        getYieldTransactionFlowIntakeVariant(session.intake, expected) !== null
      }
      fallback={widgetRoutes.earn.build()}
      navigated={navigated}
    >
      {(session) => <YieldFlowSessionRoute session={session} />}
    </TransactionFlowSessionMount>
  );
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
  const status = useAtomValue(useYieldFlowExecution().executionStatusAtom);
  if (status === "Failed") {
    return <WidgetNavigate replace to={widgetRoutes.earn.build()} />;
  }
  if (status === "Starting") return null;
  return children ?? <Outlet />;
};

/** Steps until the workflow finishes, then Complete, on the same Execution. */
export const YieldFlowExecutionPage = ({
  children,
  page,
}: PropsWithChildren<{ readonly page: "Complete" | "Steps" }>) => {
  const session = useYieldFlowSession();
  const handoff = useYieldFlowExecutionHandoff();
  const completed = useAtomValue(useYieldFlowExecution().completedAtom);
  return (
    <TransactionFlowExecutionPage
      completed={completed}
      destination={session.destination}
      navigationState={{
        ...(handoff ? { executionHandoff: handoff } : {}),
        yieldFlowSession: session,
      }}
      page={page}
    >
      {children}
    </TransactionFlowExecutionPage>
  );
};
