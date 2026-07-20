import { useAtomValue } from "@effect/atom-react";
import { Navigate } from "react-router";
import { useClassicFlowSessionFacade } from "./classic-flow-session-context";

export const ClassicFlowStepsNavigation = ({
  to = "../steps",
}: {
  readonly to?: string;
}) => {
  const facade = useClassicFlowSessionFacade();
  const navigation = useAtomValue(facade.navigationAtom);

  if (navigation !== "Steps") return null;

  return <Navigate to={to} relative="path" />;
};

export const ClassicFlowReviewNavigation = ({
  to = "../review",
}: {
  readonly to?: string;
}) => {
  const facade = useClassicFlowSessionFacade();
  const navigation = useAtomValue(facade.navigationAtom);

  if (navigation !== "Review") return null;

  return <Navigate to={to} relative="path" replace />;
};
