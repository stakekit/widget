import {
  make as makeScopedAtom,
  useAtomMount,
  useAtomValue,
} from "@effect/atom-react";
import { type PropsWithChildren, useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { sameWalletScopeOwner } from "../../../services/wallet/domain/scope";
import { useWalletScopeRoute } from "../../wallet/react/wallet-scope-route";
import type { BorrowTransactionFlowEntry } from "../model/borrow-transaction-flow";
import { getBorrowTransactionFlowRoutes } from "../model/borrow-transaction-flow";
import {
  type BorrowFlowExecutionModule,
  type BorrowFlowSessionFacade,
  type BorrowFlowSessionModule,
  makeBorrowFlowExecutionScope,
  makeBorrowFlowSessionModule,
} from "../state/borrow-flow-session-facade";
import { borrowFlowSessionStore } from "../state/borrow-flow-session-store";

const SessionScopedAtom = makeScopedAtom(makeBorrowFlowSessionModule);

const useBorrowFlowSessionModule = (): BorrowFlowSessionModule => {
  const rootAtom = useContext(SessionScopedAtom.Context);
  return useAtomValue(rootAtom);
};

export const useBorrowTransactionFlow = (): BorrowFlowSessionFacade =>
  useBorrowFlowSessionModule().facade;

const ExecutionScopedAtom = makeScopedAtom((session: BorrowFlowSessionModule) =>
  makeBorrowFlowExecutionScope(session)
);

export const useBorrowTransactionFlowExecution =
  (): BorrowFlowExecutionModule => {
    const executionAtom = useContext(ExecutionScopedAtom.Context);
    const execution = useAtomValue(executionAtom);
    if (!execution) throw new Error("Borrow Flow Execution is unavailable.");
    return execution;
  };

const matchesEntry = (
  actual: BorrowTransactionFlowEntry,
  expected: BorrowTransactionFlowEntry["_tag"]
) => actual._tag === expected;

export const BorrowTransactionFlowRoute = ({
  expected,
}: {
  readonly expected: BorrowTransactionFlowEntry["_tag"];
}) => {
  const session = useAtomValue(borrowFlowSessionStore.currentSessionAtom);
  const walletScope = useWalletScopeRoute();
  const valid =
    session &&
    walletScope &&
    matchesEntry(session.intake.entry, expected) &&
    sameWalletScopeOwner(session.walletScope, walletScope);

  if (!valid) {
    return (
      <Navigate
        to={expected === "BorrowDashboard" ? "/borrow" : "/manage"}
        replace
      />
    );
  }

  return (
    <SessionScopedAtom.Provider key={session.epoch} value={session}>
      <BorrowSessionBinding />
    </SessionScopedAtom.Provider>
  );
};

const BorrowSessionBinding = () => {
  const session = useBorrowFlowSessionModule();
  const navigation = useAtomValue(session.facade.navigationAtom);
  const { basePath } = getBorrowTransactionFlowRoutes(
    session.facade.intake.entry
  );

  return navigation === "Base" ? (
    <Navigate to={basePath} replace />
  ) : (
    <Outlet />
  );
};

export const BorrowTransactionFlowReviewRoute = () => {
  const session = useBorrowTransactionFlow();
  useAtomMount(session.reviewRootAtom);
  const navigation = useAtomValue(session.navigationAtom);
  const { stepsPath } = getBorrowTransactionFlowRoutes(session.intake.entry);

  return navigation === "Steps" ? <Navigate to={stepsPath} /> : <Outlet />;
};

export const BorrowTransactionFlowExecutionScope = ({
  children,
}: PropsWithChildren) => {
  const session = useBorrowFlowSessionModule();
  return (
    <ExecutionScopedAtom.Provider value={session}>
      <BorrowExecutionBinding>{children}</BorrowExecutionBinding>
    </ExecutionScopedAtom.Provider>
  );
};

const BorrowExecutionBinding = ({ children }: PropsWithChildren) => {
  const executionAtom = useContext(ExecutionScopedAtom.Context);
  const execution = useAtomValue(executionAtom);
  const session = useBorrowTransactionFlow();
  const routes = getBorrowTransactionFlowRoutes(session.intake.entry);

  if (!execution) return <Navigate to={routes.basePath} replace />;

  return (
    <MountedBorrowExecution execution={execution}>
      {children}
    </MountedBorrowExecution>
  );
};

const MountedBorrowExecution = ({
  children,
  execution,
}: PropsWithChildren<{ readonly execution: BorrowFlowExecutionModule }>) => {
  useAtomMount(execution.routeRootAtom);

  return (
    <>
      <BorrowCompletionNavigation execution={execution} />
      {children ?? <Outlet />}
    </>
  );
};

const BorrowCompletionNavigation = ({
  execution,
}: {
  readonly execution: BorrowFlowExecutionModule;
}) => {
  const navigation = useAtomValue(execution.completionNavigationAtom);
  const session = useBorrowTransactionFlow();
  const location = useLocation();
  const { completePath } = getBorrowTransactionFlowRoutes(session.intake.entry);
  return navigation === "Complete" && location.pathname !== completePath ? (
    <Navigate to={completePath} replace />
  ) : null;
};

export const BorrowTransactionFlowCompletionGuard = () => {
  const execution = useBorrowTransactionFlowExecution();
  const view = useAtomValue(execution.viewAtom);
  const session = useBorrowTransactionFlow();
  const { stepsPath } = getBorrowTransactionFlowRoutes(session.intake.entry);

  return view.isDone ? <Outlet /> : <Navigate to={stepsPath} replace />;
};
