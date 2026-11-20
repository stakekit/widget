import { useProvidedYieldFlowExecution } from "../../yield-flow-session";
import { ActivityCompletePage } from "./activity-complete.page.tsx";
import { EnterCompletePage } from "./enter-complete.page.tsx";
import { ExitCompletePage } from "./exit-complete.page.tsx";
import { PendingCompletePage } from "./pending-complete.page.tsx";

/** Complete for the Session's intake, each variant with its own model. */
export const YieldFlowCompletePage = () => {
  const execution = useProvidedYieldFlowExecution();
  switch (execution._tag) {
    case "Enter":
      return <EnterCompletePage execution={execution} />;
    case "Exit":
      return <ExitCompletePage execution={execution} />;
    case "Manage":
      return <PendingCompletePage execution={execution} />;
    case "YieldActionContinuation":
      return <ActivityCompletePage execution={execution} />;
  }
};
