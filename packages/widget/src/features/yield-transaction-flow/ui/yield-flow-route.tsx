import { useAtomValue } from "@effect/atom-react";
import type { PropsWithChildren } from "react";

import { widgetRoutes } from "../../../services/navigation/widget-routes";
import { useWidgetRouteState } from "../../navigation/index";
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
import type { YieldPreviewIntake } from "../model/intake";
import {
  type YieldFlowMountTag,
  type YieldFlowSession,
  yieldFlowRoutes,
} from "../model/session";
import {
  useNavigatedYieldFlowExecution,
  useYieldFlowExecutionHandoff,
  useProvidedYieldFlowExecution,
  useYieldFlowSession,
  YieldFlowEnterIntakeContext,
  YieldFlowExecutionContext,
  YieldFlowSessionContext,
} from "./yield-flow-session";

/** Every Yield flow leaves for Earn when it has nothing to show. */
const earnPath = widgetRoutes.earn.build();

/**
 * Holds the Flow Session it was navigated to while this route stays mounted.
 * A Start that navigates here again carries a new Session, which replaces it.
 */
export const YieldFlowRoute = ({
  expected,
  mount,
  trail,
}: {
  readonly expected: YieldPreviewIntake["_tag"];
  readonly mount: Exclude<YieldFlowMountTag, "YieldActionContinuation">;
  readonly trail: TransactionFlowTrail | null;
}) => {
  const navigated =
    useWidgetRouteState(yieldFlowRoutes[mount])?.yieldFlowSession ?? null;
  return (
    <TransactionFlowSessionMount
      accepts={(session) => session.intake._tag === expected}
      fallback={earnPath}
      navigated={navigated}
    >
      {(session) => <YieldFlowSessionRoute session={session} trail={trail} />}
    </TransactionFlowSessionMount>
  );
};

/** Provides `session` to its pages while the connected wallet owns it. */
export const YieldFlowSessionRoute = ({
  session,
  trail,
}: {
  readonly session: YieldFlowSession;
  readonly trail: TransactionFlowTrail | null;
}) => (
  <YieldFlowEnterIntakeContext.Provider
    value={session.intake._tag === "Enter" ? session.intake : null}
  >
    <TransactionFlowSessionRoute
      context={YieldFlowSessionContext}
      fallback={earnPath}
      owner={session.intake.walletScope}
      session={session}
      trail={trail}
    />
  </YieldFlowEnterIntakeContext.Provider>
);

/**
 * Shows Steps and Complete while their Execution runs. Leaving both ends its
 * workflow; without an action handed off by Review, it leaves the flow. A
 * handoff that cannot start, or whose workflow input proves invalid after
 * its confidential steps, leaves for Earn, which says so.
 */
export const YieldFlowExecutionRoute = ({ children }: PropsWithChildren) => (
  <TransactionFlowExecutionRoute
    context={YieldFlowExecutionContext}
    execution={useNavigatedYieldFlowExecution()}
    failed={widgetRoutes.earn
      .withState(TransactionFlowFailureState)
      .build(executionUnavailableState)}
    fallback={earnPath}
  >
    {children}
  </TransactionFlowExecutionRoute>
);

/** Steps until the workflow finishes, then Complete, on the same Execution. */
export const YieldFlowExecutionPage = ({
  children,
  page,
}: PropsWithChildren<{ readonly page: "Complete" | "Steps" }>) => {
  const session = useYieldFlowSession();
  const handoff = useYieldFlowExecutionHandoff();
  const completed = useAtomValue(
    useProvidedYieldFlowExecution().completionAtom
  );
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
