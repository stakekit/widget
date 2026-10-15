import { make as makeScopedAtom, useAtomValue } from "@effect/atom-react";
import { Option, Schema } from "effect";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router";
import {
  type MarketId,
  MarketId as MarketIdSchema,
} from "../../../domain/borrow/ids";
import { LoadingSkeleton } from "../../../shared/ui/components/loading-skeleton";
import {
  type BorrowFlowSession,
  type BorrowTransactionFlowEntry,
  decodeBorrowFlowNavigationState,
  getBorrowTransactionFlowRoutes,
} from "../model/borrow-transaction-flow";
import {
  type BorrowFlowExecutionFacade,
  type BorrowFlowReviewFacade,
  type BorrowFlowSessionFacade,
  type BorrowFlowSessionModule,
  makeBorrowFlowExecutionScope,
  makeBorrowFlowReviewScope,
  makeBorrowFlowSessionModule,
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

const SessionScopedAtom = makeScopedAtom(makeBorrowFlowSessionModule);
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

type MountedBorrowFlowSession = Readonly<{
  /** The location that delivered the Session; remounts the Session subtree. */
  readonly key: string;
  readonly session: BorrowFlowSession;
}>;

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
  const routeParams = useParams();
  const marketId = routeParams.marketId
    ? Schema.decodeSync(MarketIdSchema)(routeParams.marketId)
    : undefined;
  const location = useLocation();
  const navigated = Option.getOrNull(
    decodeBorrowFlowNavigationState(location.state)
  );
  const [mounted, setMounted] = useState<MountedBorrowFlowSession | null>(null);
  if (navigated && navigated !== mounted?.session) {
    setMounted({ key: location.key, session: navigated });
    return null;
  }
  if (
    !mounted ||
    !matchesEntry(mounted.session.intake.entry, expected, marketId)
  ) {
    return <Navigate replace to={getEntryFallbackPath(expected, marketId)} />;
  }
  return (
    <SessionScopedAtom.Provider key={mounted.key} value={mounted.session}>
      <MountedSessionBinding />
    </SessionScopedAtom.Provider>
  );
};

const MountedSessionBinding = () => {
  // Not `SessionScopedAtom.use()`: React Compiler does not treat a member named
  // `use` as a hook and caches the call, which drops its useContext on rerender.
  const sessionAtom = useContext(SessionScopedAtom.Context);
  const session = useAtomValue(sessionAtom);
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
