import { make as makeScopedAtom, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import {
  type ClassicFlowSession,
  type ClassicTransactionFlowIntake,
  decodeClassicFlowNavigationState,
  getClassicTransactionFlowIntakeVariant,
} from "../model/classic-transaction-flow";
import {
  type ClassicFlowExecutionFacade,
  type ClassicFlowReviewFacade,
  type ClassicFlowSessionFacade,
  type ClassicFlowSessionModule,
  makeClassicFlowExecutionScope,
  makeClassicFlowReviewScope,
  makeClassicFlowSessionModule,
} from "../state/atoms/classic-flow-session";

const useClassicFlowSessionModule = (): ClassicFlowSessionModule => {
  const session = useContext(ClassicFlowSessionContext);
  if (!session) throw new Error("Classic Flow Session is unavailable.");
  return session;
};

const ClassicFlowSessionContext =
  createContext<ClassicFlowSessionModule | null>(null);

export const useClassicFlowSession = (): ClassicFlowSessionFacade => {
  const session = useClassicFlowSessionModule();
  return session.facade;
};

const SessionScopedAtom = makeScopedAtom(makeClassicFlowSessionModule);
const ReviewScopedAtom = makeScopedAtom(makeClassicFlowReviewScope);

export const useClassicFlowReview = (): ClassicFlowReviewFacade => {
  const reviewAtom = useContext(ReviewScopedAtom.Context);
  return useAtomValue(reviewAtom).facade;
};

const ExecutionScopedAtom = makeScopedAtom(makeClassicFlowExecutionScope);

export const useClassicFlowExecution = (): ClassicFlowExecutionFacade => {
  const executionAtom = useContext(ExecutionScopedAtom.Context);
  return useAtomValue(executionAtom).facade;
};

export const useClassicFlowIntake = <
  Variant extends ClassicTransactionFlowIntake["_tag"],
>(
  variant: Variant
): Extract<ClassicTransactionFlowIntake, { readonly _tag: Variant }> => {
  const session = useClassicFlowSession();
  return session.getIntake(variant);
};

type MountedClassicFlowSession = Readonly<{
  /** The location that delivered the Session; remounts the Session subtree. */
  readonly key: string;
  readonly session: ClassicFlowSession;
}>;

/**
 * Owns the Flow Session it was navigated to: the Session lives while this
 * route stays mounted and ends when it unmounts. A Start that navigates here
 * again carries a new Session, which replaces the mounted one.
 */
export const ClassicFlowRoute = ({
  expected,
}: {
  readonly expected: Exclude<
    ClassicTransactionFlowIntake["_tag"],
    "YieldActionContinuation"
  >;
}) => {
  const location = useLocation();
  const navigated = Option.getOrNull(
    decodeClassicFlowNavigationState(location.state)
  );
  const [mounted, setMounted] = useState<MountedClassicFlowSession | null>(
    null
  );
  if (navigated && navigated !== mounted?.session) {
    setMounted({ key: location.key, session: navigated });
    return null;
  }
  if (
    !mounted ||
    !getClassicTransactionFlowIntakeVariant(mounted.session.intake, expected)
  ) {
    return <Navigate to="/" replace />;
  }
  return (
    <ClassicFlowSessionRoute key={mounted.key} session={mounted.session} />
  );
};

/**
 * Owns `session` for as long as it stays mounted. Callers remount it (by key)
 * to replace the Session.
 */
export const ClassicFlowSessionRoute = ({
  session,
}: {
  readonly session: ClassicFlowSession;
}) => (
  <SessionScopedAtom.Provider value={session}>
    <MountedSessionBinding />
  </SessionScopedAtom.Provider>
);

const MountedSessionBinding = () => {
  // Not `SessionScopedAtom.use()`: React Compiler does not treat a member named
  // `use` as a hook and caches the call, which drops its useContext on rerender.
  const sessionAtom = useContext(SessionScopedAtom.Context);
  const session = useAtomValue(sessionAtom);

  return (
    <ClassicFlowSessionContext.Provider value={session}>
      <Outlet />
    </ClassicFlowSessionContext.Provider>
  );
};

export const ClassicFlowReviewScope = ({ children }: PropsWithChildren) => {
  const session = useClassicFlowSessionModule();

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
  if (availability._tag === "Failure") return <Navigate to="/" replace />;
  if (availability._tag !== "Success") return null;
  return children ?? <Outlet />;
};

export const ClassicFlowExecutionScope = ({ children }: PropsWithChildren) => {
  const session = useClassicFlowSessionModule();

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
  if (availability._tag === "Failure") return <Navigate to="/" replace />;
  if (availability._tag !== "Success") return null;

  return children ?? <Outlet />;
};
