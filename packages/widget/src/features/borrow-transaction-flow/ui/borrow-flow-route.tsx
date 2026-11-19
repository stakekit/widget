import { useAtomValue } from "@effect/atom-react";
import type { PropsWithChildren } from "react";

import type { MarketId } from "../../../domain/borrow/ids";
import { widgetRoutes } from "../../../services/navigation/widget-routes";
import {
  useWidgetRoutePrefixMatch,
  useWidgetRouteState,
} from "../../navigation/index";
import {
  executionUnavailableState,
  TransactionFlowFailureState,
  type TransactionFlowTrail,
} from "../../transaction-flow/index";
import {
  TransactionFlowExecutionPage,
  TransactionFlowExecutionRoute,
  TransactionFlowSessionMount,
  TransactionFlowSessionRoute,
} from "../../transaction-flow/views";
import {
  type BorrowTransactionFlowEntry,
  borrowFlowRoutes,
  getBorrowTransactionFlowDestination,
} from "../model/session";
import {
  BorrowFlowExecutionContext,
  BorrowFlowSessionContext,
  useNavigatedBorrowFlowExecution,
  useBorrowFlowExecutionActionId,
  useBorrowFlowSession,
  useProvidedBorrowFlowExecution,
} from "./borrow-flow-session";

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

/** The page an Execution that cannot start leaves for, saying so. */
const getFailedExecutionTarget = (entry: BorrowTransactionFlowEntry) =>
  entry._tag === "BorrowEntry"
    ? widgetRoutes.borrow
        .withState(TransactionFlowFailureState)
        .build(executionUnavailableState, "Dashboard")
    : widgetRoutes.borrowPosition
        .withState(TransactionFlowFailureState)
        .build(executionUnavailableState, "Dashboard", {
          marketId: entry.marketId,
        });

/**
 * Owns the Flow Session it was navigated to: the Session lives while this
 * route stays mounted and ends when it unmounts. A Start that navigates here
 * again carries a new Session, which replaces the mounted one.
 */
export const BorrowTransactionFlowRoute = ({
  expected,
  trail,
}: {
  readonly expected: BorrowTransactionFlowEntry["_tag"];
  readonly trail: TransactionFlowTrail | null;
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
      {(session) => (
        <TransactionFlowSessionRoute
          context={BorrowFlowSessionContext}
          fallback={
            getBorrowTransactionFlowDestination(session.intake.entry).basePath
          }
          owner={session.walletScope}
          session={session}
          trail={trail}
        />
      )}
    </TransactionFlowSessionMount>
  );
};

/**
 * Shows Steps and Complete while their Execution runs. Leaving both ends its
 * workflow; without an action handed off by Review, it leaves the flow. One
 * that cannot start leaves for where the flow began, which says so.
 */
export const BorrowTransactionFlowExecutionRoute = ({
  children,
}: PropsWithChildren) => {
  const { intake } = useBorrowFlowSession();
  return (
    <TransactionFlowExecutionRoute
      context={BorrowFlowExecutionContext}
      execution={useNavigatedBorrowFlowExecution()}
      failed={getFailedExecutionTarget(intake.entry)}
      fallback={getBorrowTransactionFlowDestination(intake.entry).basePath}
    >
      {children}
    </TransactionFlowExecutionRoute>
  );
};

/** Steps until the workflow completes, then Complete, on the same Execution. */
export const BorrowTransactionFlowExecutionPage = ({
  children,
  page,
}: PropsWithChildren<{ readonly page: "Complete" | "Steps" }>) => {
  const session = useBorrowFlowSession();
  const actionId = useBorrowFlowExecutionActionId();
  const completed = useAtomValue(
    useProvidedBorrowFlowExecution().completionAtom
  );
  return (
    <TransactionFlowExecutionPage
      completed={completed}
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
