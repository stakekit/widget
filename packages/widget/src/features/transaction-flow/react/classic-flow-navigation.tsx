import { useAtomValue } from "@effect/atom-react";
import { Navigate } from "react-router";
import { classicTransactionFlowFacade } from "../state/classic-flow-facade";

export const ClassicFlowStepsNavigation = ({
  to = "../steps",
}: {
  readonly to?: string;
}) => {
  const activeFlow = useAtomValue(classicTransactionFlowFacade.activeFlowAtom);
  const navigation = useAtomValue(classicTransactionFlowFacade.navigationAtom);

  if (
    navigation?._tag !== "NavigateToSteps" ||
    activeFlow?.identity !== navigation.flowIdentity
  ) {
    return null;
  }

  return <Navigate to={to} relative="path" />;
};

export const ClassicFlowReviewNavigation = ({
  to = "../review",
}: {
  readonly to?: string;
}) => {
  const activeFlow = useAtomValue(classicTransactionFlowFacade.activeFlowAtom);
  const navigation = useAtomValue(classicTransactionFlowFacade.navigationAtom);

  if (
    navigation?._tag !== "NavigateToReview" ||
    activeFlow?.identity !== navigation.flowIdentity
  ) {
    return null;
  }

  return <Navigate to={to} relative="path" replace />;
};
