import { make as makeScopedAtom, useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { createContext, type PropsWithChildren, useContext } from "react";
import { Navigate, Outlet, useParams } from "react-router";
import {
  type MarketId,
  MarketId as MarketIdSchema,
} from "../../../domain/borrow/ids";
import type { BorrowTransactionFlowEntry } from "../model/borrow-transaction-flow";
import { getBorrowTransactionFlowRoutes } from "../model/borrow-transaction-flow";
import { currentBorrowFlowSessionAtom } from "../state/atoms/borrow-flow";
import {
  type BorrowFlowExecutionFacade,
  type BorrowFlowReviewFacade,
  type BorrowFlowSessionFacade,
  type BorrowFlowSessionModule,
  currentBorrowFlowSessionRootAtom,
  makeBorrowFlowExecutionScope,
  makeBorrowFlowReviewScope,
} from "../state/atoms/borrow-flow-session";

const BorrowFlowSessionContext = createContext<BorrowFlowSessionModule | null>(
  null
);

const useBorrowFlowSessionModule = (): BorrowFlowSessionModule => {
  const session = useContext(BorrowFlowSessionContext);
  if (!session) throw new Error("Borrow Flow Session is unavailable.");
  return session;
};

export const useBorrowTransactionFlow = (): BorrowFlowSessionFacade =>
  useBorrowFlowSessionModule().facade;

const ReviewScopedAtom = makeScopedAtom(makeBorrowFlowReviewScope);

export const useBorrowTransactionFlowReview = (): BorrowFlowReviewFacade => {
  const reviewAtom = useContext(ReviewScopedAtom.Context);
  return useAtomValue(reviewAtom).facade;
};

const ExecutionScopedAtom = makeScopedAtom(makeBorrowFlowExecutionScope);

export const useBorrowTransactionFlowExecution =
  (): BorrowFlowExecutionFacade => {
    const executionAtom = useContext(ExecutionScopedAtom.Context);
    return useAtomValue(executionAtom).facade;
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
  if (expected === "BorrowEntry") return "/borrow";
  if (marketId) return `/positions/borrow/${marketId}`;
  return "/positions";
};

export const BorrowTransactionFlowRoute = ({
  expected,
}: {
  readonly expected: BorrowTransactionFlowEntry["_tag"];
}) => {
  const routeParams = useParams();
  const marketId = routeParams.marketId
    ? Schema.decodeSync(MarketIdSchema)(routeParams.marketId)
    : undefined;
  const session = useAtomValue(currentBorrowFlowSessionAtom);
  if (session && matchesEntry(session.intake.entry, expected, marketId)) {
    return <SessionBinding entry={session.intake.entry} key={session.epoch} />;
  }
  const fallbackPath = getEntryFallbackPath(expected, marketId);
  return <Navigate replace to={fallbackPath} />;
};

const SessionBinding = ({
  entry,
}: {
  readonly entry: BorrowTransactionFlowEntry;
}) => {
  const rootAtom = useAtomValue(currentBorrowFlowSessionRootAtom);
  if (!rootAtom) {
    return (
      <Navigate replace to={getBorrowTransactionFlowRoutes(entry).basePath} />
    );
  }
  return <MountedSessionBinding rootAtom={rootAtom} />;
};

const MountedSessionBinding = ({
  rootAtom,
}: {
  readonly rootAtom: NonNullable<
    Atom.Type<typeof currentBorrowFlowSessionRootAtom>
  >;
}) => {
  const session = useAtomValue(rootAtom);
  return (
    <BorrowFlowSessionContext.Provider value={session}>
      <Outlet />
    </BorrowFlowSessionContext.Provider>
  );
};

export const BorrowTransactionFlowReviewRoute = ({
  children,
}: PropsWithChildren) => {
  const session = useBorrowFlowSessionModule();
  return (
    <ReviewScopedAtom.Provider value={session}>
      <ReviewBinding>{children}</ReviewBinding>
    </ReviewScopedAtom.Provider>
  );
};

const ReviewBinding = ({ children }: PropsWithChildren) => {
  const reviewAtom = useContext(ReviewScopedAtom.Context);
  const review = useAtomValue(reviewAtom);
  const availability = useAtomValue(review.availabilityAtom);
  const { basePath } = getBorrowTransactionFlowRoutes(
    useBorrowTransactionFlow().intake.entry
  );
  if (availability._tag === "Failure") {
    return <Navigate replace to={basePath} />;
  }
  if (availability._tag !== "Success") return null;
  return children ?? <Outlet />;
};

export const BorrowTransactionFlowExecutionScope = ({
  children,
}: PropsWithChildren) => {
  const session = useBorrowFlowSessionModule();
  return (
    <ExecutionScopedAtom.Provider value={session}>
      <ExecutionBinding>{children}</ExecutionBinding>
    </ExecutionScopedAtom.Provider>
  );
};

const ExecutionBinding = ({ children }: PropsWithChildren) => {
  const executionAtom = useContext(ExecutionScopedAtom.Context);
  const execution = useAtomValue(executionAtom);
  const availability = useAtomValue(execution.availabilityAtom);
  const state = useAtomValue(execution.stateAtom);
  const { basePath } = getBorrowTransactionFlowRoutes(
    useBorrowTransactionFlow().intake.entry
  );

  if (availability._tag === "Failure") {
    return <Navigate replace to={basePath} />;
  }
  if (availability._tag !== "Success") return null;
  if (availability.value._tag !== "Acquired") {
    return <Navigate replace to={basePath} />;
  }
  if (state._tag === "Initial") return null;
  return children ?? <Outlet />;
};

export const BorrowTransactionFlowCompletionGuard = () => {
  const execution = useBorrowTransactionFlowExecution();
  const view = useAtomValue(execution.viewAtom);
  const { stepsPath } = getBorrowTransactionFlowRoutes(
    useBorrowTransactionFlow().intake.entry
  );
  return view.isDone ? <Outlet /> : <Navigate replace to={stepsPath} />;
};
