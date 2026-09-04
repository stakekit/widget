import { make as makeScopedAtom, useAtomValue } from "@effect/atom-react";
import { Schema } from "effect";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react";
import { Navigate, Outlet, useParams } from "react-router";
import {
  type MarketId,
  MarketId as MarketIdSchema,
} from "../../../domain/borrow/ids";
import { LoadingSkeleton } from "../../../shared/ui/components/loading-skeleton";
import type { BorrowTransactionFlowEntry } from "../model/borrow-transaction-flow";
import { getBorrowTransactionFlowRoutes } from "../model/borrow-transaction-flow";
import { makeBorrowFlowRouteSessionAtom } from "../state/atoms/borrow-flow";
import {
  type BorrowFlowExecutionFacade,
  type BorrowFlowReviewFacade,
  type BorrowFlowSessionFacade,
  type BorrowFlowSessionModule,
  borrowFlowSessionRootAtomFamily,
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
  const [sessionAtom] = useState(makeBorrowFlowRouteSessionAtom);
  const result = useAtomValue(sessionAtom);
  const fallbackPath = getEntryFallbackPath(expected, marketId);
  if (result._tag === "Initial") return <LoadingSkeleton />;
  if (result._tag === "Failure") return <Navigate replace to={fallbackPath} />;
  const session = result.value;
  if (session && matchesEntry(session.intake.entry, expected, marketId)) {
    return (
      <MountedSessionBinding
        key={session.epoch}
        rootAtom={borrowFlowSessionRootAtomFamily(session)}
      />
    );
  }
  return <Navigate replace to={fallbackPath} />;
};

const MountedSessionBinding = ({
  rootAtom,
}: {
  readonly rootAtom: ReturnType<typeof borrowFlowSessionRootAtomFamily>;
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
  const [completionAtom] = useState(() => execution.makeCompletionStateAtom());
  const result = useAtomValue(completionAtom);
  const view = useAtomValue(execution.viewAtom);
  const { stepsPath } = getBorrowTransactionFlowRoutes(
    useBorrowTransactionFlow().intake.entry
  );
  if (result._tag === "Initial") return <LoadingSkeleton />;
  if (result._tag === "Failure" || !result.value) {
    return <Navigate replace to={stepsPath} />;
  }
  // Admission is authoritative; the page still needs its completion details.
  if (!view.isDone) return <LoadingSkeleton />;
  return <Outlet />;
};
