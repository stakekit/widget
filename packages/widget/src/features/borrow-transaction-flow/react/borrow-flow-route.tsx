import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { createContext, type PropsWithChildren, useContext } from "react";
import { Outlet, useLocation } from "react-router";
import type { MarketId } from "../../../domain/borrow/ids";
import { sameWalletScopeOwner } from "../../../domain/wallet/wallet-scope";
import { widgetRoutes } from "../../../services/navigation/widget-routes";
import {
  useWidgetRoutePrefixMatch,
  useWidgetRouteState,
} from "../../navigation/index";
import { WidgetNavigate } from "../../navigation/views";
import {
  TransactionFlowExecutionPage,
  TransactionFlowSessionMount,
} from "../../transaction-flow/views";
import { walletScopeAtom } from "../../wallet/index";
import {
  type BorrowFlowSession,
  type BorrowTransactionFlowEntry,
  borrowFlowRoutes,
  getBorrowTransactionFlowDestination,
} from "../model/session";
import {
  BorrowFlowExecutionKey,
  borrowFlowExecutionPage,
} from "../state/execution-page";
import {
  BorrowFlowReviewVisit,
  borrowFlowReviewPage,
} from "../state/review-page";

const BorrowFlowSessionContext = createContext<BorrowFlowSession | null>(null);

export const useBorrowTransactionFlow = (): BorrowFlowSession => {
  const session = useContext(BorrowFlowSessionContext);
  if (!session) throw new Error("Borrow Flow Session is unavailable.");
  return session;
};

/** This visit's Review: the same Atoms for every render of it. */
export const useBorrowTransactionFlowReview = () =>
  useAtomValue(
    borrowFlowReviewPage(
      new BorrowFlowReviewVisit({
        session: useBorrowTransactionFlow(),
        visit: useLocation().key,
      })
    )
  );

/** The action Steps and Complete were navigated to run, if any. */
const useBorrowFlowExecutionActionId = () => {
  const { intake } = useBorrowTransactionFlow();
  return (
    useWidgetRouteState(borrowFlowRoutes[intake.entry._tag])
      ?.executionActionId ?? null
  );
};

/** The Execution of the action Steps and Complete were navigated to run. */
export const useBorrowTransactionFlowExecution = () => {
  const actionId = useBorrowFlowExecutionActionId();
  const session = useBorrowTransactionFlow();
  if (!actionId) throw new Error("Borrow Flow Execution is unavailable.");
  return useAtomValue(
    borrowFlowExecutionPage(new BorrowFlowExecutionKey({ actionId, session }))
  );
};

const matchesEntry = (
  actual: BorrowTransactionFlowEntry,
  expected: BorrowTransactionFlowEntry["_tag"],
  marketId: MarketId | undefined
) =>
  actual._tag === expected &&
  (actual._tag !== "MarketPosition" || actual.marketId === marketId);

const getEntryFallbackPath = (
  expected: BorrowTransactionFlowEntry["_tag"],
  marketId: MarketId | undefined
) => {
  if (expected === "BorrowEntry") {
    return widgetRoutes.borrow.build("Dashboard");
  }
  if (marketId) {
    return widgetRoutes.borrowPosition.build("Dashboard", { marketId });
  }
  return widgetRoutes.positions.build();
};

/**
 * Owns the Flow Session it was navigated to: the Session lives while this
 * route stays mounted and ends when it unmounts. A Start that navigates here
 * again carries a new Session, which replaces the mounted one.
 */
export const BorrowTransactionFlowRoute = ({
  expected,
}: {
  readonly expected: BorrowTransactionFlowEntry["_tag"];
}) => {
  const marketId = useWidgetRoutePrefixMatch(
    widgetRoutes.borrowPosition
  )?.marketId;
  const navigated =
    useWidgetRouteState(borrowFlowRoutes[expected])?.borrowFlowSession ?? null;
  return (
    <TransactionFlowSessionMount
      accepts={(session) =>
        matchesEntry(session.intake.entry, expected, marketId)
      }
      fallback={getEntryFallbackPath(expected, marketId)}
      navigated={navigated}
    >
      {(session) => <BorrowFlowSessionRoute session={session} />}
    </TransactionFlowSessionMount>
  );
};

/** Provides `session` to its pages while the connected wallet owns it. */
const BorrowFlowSessionRoute = ({
  session,
}: {
  readonly session: BorrowFlowSession;
}) => {
  const walletScope = useAtomValue(walletScopeAtom);
  if (!walletScope || !sameWalletScopeOwner(walletScope, session.walletScope)) {
    return (
      <WidgetNavigate
        replace
        to={getBorrowTransactionFlowDestination(session.intake.entry).basePath}
      />
    );
  }
  return (
    <BorrowFlowSessionContext.Provider value={session}>
      <Outlet />
    </BorrowFlowSessionContext.Provider>
  );
};

/**
 * Shows Steps and Complete while their Execution runs. Leaving both ends its
 * workflow; without an action handed off by Review, it leaves the flow.
 */
export const BorrowTransactionFlowExecutionRoute = ({
  children,
}: PropsWithChildren) => {
  const { intake } = useBorrowTransactionFlow();
  const actionId = useBorrowFlowExecutionActionId();
  if (!actionId) {
    return (
      <WidgetNavigate
        replace
        to={getBorrowTransactionFlowDestination(intake.entry).basePath}
      />
    );
  }
  return <ExecutionStarted>{children}</ExecutionStarted>;
};

const ExecutionStarted = ({ children }: PropsWithChildren) => {
  const { intake } = useBorrowTransactionFlow();
  const workflow = useAtomValue(
    useBorrowTransactionFlowExecution().workflowAtom
  );
  if (workflow._tag === "Failure") {
    return (
      <WidgetNavigate
        replace
        to={getBorrowTransactionFlowDestination(intake.entry).basePath}
      />
    );
  }
  if (workflow._tag === "Initial") return null;
  return children ?? <Outlet />;
};

/** Steps until the workflow completes, then Complete, on the same Execution. */
export const BorrowTransactionFlowExecutionPage = ({
  children,
  page,
}: PropsWithChildren<{ readonly page: "Complete" | "Steps" }>) => {
  const session = useBorrowTransactionFlow();
  const actionId = useBorrowFlowExecutionActionId();
  const state = useAtomValue(useBorrowTransactionFlowExecution().stateAtom);
  if (!AsyncResult.isSuccess(state)) return null;
  return (
    <TransactionFlowExecutionPage
      completed={state.value._tag === "Completed"}
      destination={getBorrowTransactionFlowDestination(session.intake.entry)}
      navigationState={{
        borrowFlowSession: session,
        ...(actionId ? { executionActionId: actionId } : {}),
      }}
      page={page}
    >
      {children}
    </TransactionFlowExecutionPage>
  );
};
