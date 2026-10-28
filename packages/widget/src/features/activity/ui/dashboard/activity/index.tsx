import { useAtomValue } from "@effect/atom-react";
import { Outlet } from "react-router";
import { widgetYieldFlowRoutes } from "../../../../../services/navigation/widget-routes";
import { Box } from "../../../../../shared/ui/primitives/box";
import { useWidgetRouteMatch } from "../../../../navigation/index";
import { useSKWallet } from "../../../../wallet/index";
import {
  AnimationPage,
  BackButtonProvider,
} from "../../../../widget-shell/views";
import { activityPageViewAtom, hasActivityActions } from "../../../state/page";
import { ActivityPageContent } from "../../activity-page/activity-page-content";
import * as styles from "./styles.css";

export const ActivityTabPage = () => {
  const wallet = useSKWallet();
  const view = useAtomValue(activityPageViewAtom);
  const stepsMatch = useWidgetRouteMatch(
    widgetYieldFlowRoutes.YieldActionContinuation.steps
  );
  const completeMatch = useWidgetRouteMatch(
    widgetYieldFlowRoutes.YieldActionContinuation.complete
  );
  const isExecution = stepsMatch !== null || completeMatch !== null;
  const showSplit = wallet?.status === "connected" && hasActivityActions(view);

  if (!showSplit) {
    return (
      <AnimationPage>
        <ActivityPageContent allowDefaultSelection />
      </AnimationPage>
    );
  }

  return (
    <AnimationPage>
      <Box className={styles.split}>
        <Box className={styles.feed}>
          <ActivityPageContent allowDefaultSelection />
        </Box>
        <Box
          className={isExecution ? styles.execution : styles.details}
          data-rk={
            isExecution ? "activity-execution-panel" : "activity-details-panel"
          }
        >
          {/* One tree shape for Review and execution: the action route below
              owns the continuation Session across them. */}
          <BackButtonProvider enabled={isExecution}>
            <Outlet />
          </BackButtonProvider>
        </Box>
      </Box>
    </AnimationPage>
  );
};
