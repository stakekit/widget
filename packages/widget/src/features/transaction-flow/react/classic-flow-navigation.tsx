import { useAtomValue } from "@effect/atom-react";
import { Navigate } from "react-router";
import { classicTransactionFlowFacade } from "../state/classic-flow-facade";

export const ClassicFlowStepsNavigation = () => {
  const activeFlow = useAtomValue(classicTransactionFlowFacade.activeFlowAtom);
  const navigation = useAtomValue(classicTransactionFlowFacade.navigationAtom);

  if (
    navigation?._tag !== "NavigateToSteps" ||
    activeFlow?.identity !== navigation.flowIdentity
  ) {
    return null;
  }

  return <Navigate to="../steps" relative="path" />;
};
