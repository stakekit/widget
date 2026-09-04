import { make as makeScopedAtom, useAtomValue } from "@effect/atom-react";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react";
import { Navigate, Outlet } from "react-router";
import { LoadingSkeleton } from "../../../shared/ui/components/loading-skeleton";
import {
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowIntakeVariant,
} from "../model/classic-transaction-flow";
import { makeClassicFlowRouteSessionAtom } from "../state/atoms/classic-flow";
import {
  type ClassicFlowExecutionFacade,
  type ClassicFlowReviewFacade,
  type ClassicFlowSessionFacade,
  type ClassicFlowSessionModule,
  classicFlowSessionRootAtomFamily,
  makeClassicFlowExecutionScope,
  makeClassicFlowReviewScope,
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

export const ClassicFlowRoute = ({
  expected,
}: {
  readonly expected: ClassicTransactionFlowIntake["_tag"];
}) => {
  const [sessionAtom] = useState(makeClassicFlowRouteSessionAtom);
  const result = useAtomValue(sessionAtom);
  if (result._tag === "Initial") return <LoadingSkeleton />;
  if (result._tag === "Failure") return <Navigate to="/" replace />;
  const session = result.value;
  const intake = session
    ? getClassicTransactionFlowIntakeVariant(session.intake, expected)
    : null;

  if (session && intake) {
    return (
      <MountedSessionBinding
        key={session.epoch}
        rootAtom={classicFlowSessionRootAtomFamily(session)}
      />
    );
  }

  return <Navigate to="/" replace />;
};

const MountedSessionBinding = ({
  rootAtom,
}: {
  readonly rootAtom: ReturnType<typeof classicFlowSessionRootAtomFamily>;
}) => {
  const session = useAtomValue(rootAtom);

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
