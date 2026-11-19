import { useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/reactivity/Atom";
import {
  type Context,
  Fragment,
  type PropsWithChildren,
  type ReactNode,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation } from "react-router";

import {
  sameWalletScopeOwner,
  type WalletScopeKey,
} from "../../../domain/wallet/wallet-scope";
import type {
  WidgetNavigationTarget,
  WidgetPath,
} from "../../../services/navigation/widget-routes";
import { Spinner, Stack } from "../../../ui/index";
import { WidgetNavigate } from "../../navigation/views";
import { walletScopeAtom } from "../../wallet/index";
import { PageContainer } from "../../widget-shell/views";
import type { TransactionFlowTrail } from "../model/trail";
import type { TransactionFlowExecutionStatus } from "../state/execution";
import { TransactionFlowTrailContext } from "./transaction-flow-page-header";

type MountedSession<Session> = Readonly<{
  /** The location that delivered the Session; remounts the Session subtree. */
  readonly key: string;
  readonly session: Session;
}>;

/**
 * Holds the Flow Session this route was navigated to while it stays mounted:
 * the Session lives until it unmounts. A Start that navigates here again
 * carries a new Session, which replaces it and remounts what `children`
 * renders. Without a Session it `accepts`, it leaves for `fallback`.
 */
export const TransactionFlowSessionMount = <Session extends object>({
  accepts,
  children,
  fallback,
  navigated,
}: {
  readonly accepts: (session: Session) => boolean;
  readonly children: (session: Session) => ReactNode;
  readonly fallback: WidgetPath;
  /** The Session in this route's navigation state, if any. */
  readonly navigated: Session | null;
}) => {
  const location = useLocation();
  const [mounted, setMounted] = useState<MountedSession<Session> | null>(null);
  if (navigated && navigated !== mounted?.session) {
    setMounted({ key: location.key, session: navigated });
    return null;
  }
  if (!mounted || !accepts(mounted.session)) {
    return <WidgetNavigate replace to={fallback} />;
  }
  return <Fragment key={mounted.key}>{children(mounted.session)}</Fragment>;
};

/**
 * Provides `session` to its pages while the connected wallet is its
 * `owner`, else leaves for `fallback`. `trail`, when the composition gives
 * one, puts a breadcrumb header with a back button on each page.
 */
export const TransactionFlowSessionRoute = <Session,>({
  context,
  fallback,
  owner,
  session,
  trail,
}: {
  readonly context: Context<Session | null>;
  readonly fallback: WidgetNavigationTarget;
  readonly owner: WalletScopeKey;
  readonly session: Session;
  readonly trail: TransactionFlowTrail | null;
}) => {
  const walletScope = useAtomValue(walletScopeAtom);
  if (!walletScope || !sameWalletScopeOwner(walletScope, owner)) {
    return <WidgetNavigate replace to={fallback} />;
  }
  const SessionProvider = context.Provider;
  return (
    <SessionProvider value={session}>
      <TransactionFlowTrailContext.Provider value={trail}>
        <Outlet />
      </TransactionFlowTrailContext.Provider>
    </SessionProvider>
  );
};

/**
 * Shows Steps and Complete while their Execution runs, providing it to them
 * through `context`. Leaving both ends its workflow. Without an Execution
 * handed off by Review (`execution` null), it leaves for `fallback`; one that
 * fails to start leaves for `failed`, which says so.
 */
export const TransactionFlowExecutionRoute = <
  Execution extends Readonly<{
    readonly executionStatusAtom: Atom.Atom<TransactionFlowExecutionStatus>;
  }>,
>({
  children,
  context,
  execution,
  failed,
  fallback,
}: PropsWithChildren<{
  readonly context: Context<Execution | null>;
  readonly execution: Execution | null;
  readonly failed: WidgetNavigationTarget;
  readonly fallback: WidgetNavigationTarget;
}>) => {
  if (!execution) return <WidgetNavigate replace to={fallback} />;
  const ExecutionProvider = context.Provider;
  return (
    <ExecutionStarted
      failed={failed}
      statusAtom={execution.executionStatusAtom}
    >
      <ExecutionProvider value={execution}>
        {children ?? <Outlet />}
      </ExecutionProvider>
    </ExecutionStarted>
  );
};

const ExecutionStarted = ({
  children,
  failed,
  statusAtom,
}: PropsWithChildren<{
  readonly failed: WidgetNavigationTarget;
  readonly statusAtom: Atom.Atom<TransactionFlowExecutionStatus>;
}>) => {
  const { t } = useTranslation();
  const status = useAtomValue(statusAtom);
  if (status === "Failed") return <WidgetNavigate replace to={failed} />;
  if (status === "Starting") {
    return (
      <PageContainer>
        <Stack align="center" justify="center" grow>
          <Spinner size="lg" label={t("transaction_steps.starting")} />
        </Stack>
      </PageContainer>
    );
  }
  return children;
};

/**
 * Keeps Steps and Complete in step with their Execution: Steps until it
 * `completed`, then Complete, both carrying `navigationState` so they show the
 * same Execution.
 */
export const TransactionFlowExecutionPage = <State,>({
  children,
  completed,
  destination,
  navigationState,
  page,
}: PropsWithChildren<{
  readonly completed: boolean;
  /** The flow's Steps and Complete locations for the same Execution. */
  readonly destination: Readonly<{
    readonly complete: (state: State) => WidgetNavigationTarget;
    readonly steps: (state: State) => WidgetNavigationTarget;
  }>;
  readonly navigationState: NoInfer<State>;
  readonly page: "Complete" | "Steps";
}>) => {
  if (page === "Steps" && completed) {
    return (
      <WidgetNavigate replace to={destination.complete(navigationState)} />
    );
  }
  if (page === "Complete" && !completed) {
    return <WidgetNavigate replace to={destination.steps(navigationState)} />;
  }
  return children ?? <Outlet />;
};
