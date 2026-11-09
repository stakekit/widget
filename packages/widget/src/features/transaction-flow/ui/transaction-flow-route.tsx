import {
  Fragment,
  type PropsWithChildren,
  type ReactNode,
  useState,
} from "react";
import { Outlet, useLocation } from "react-router";

import type {
  WidgetNavigationTarget,
  WidgetPath,
} from "../../../services/navigation/widget-routes";
import { WidgetNavigate } from "../../navigation/views";

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
