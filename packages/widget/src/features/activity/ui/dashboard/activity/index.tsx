import { useAtomValue } from "@effect/atom-react";
import { Outlet } from "react-router";
import { widgetYieldFlowRoutes } from "../../../../../services/navigation/widget-routes";
import { Grid, Stack } from "../../../../../ui/index";
import { useWidgetRouteMatch } from "../../../../navigation/index";
import { useSKWallet } from "../../../../wallet/index";
import {
  AnimationPage,
  BackButtonProvider,
} from "../../../../widget-shell/views";
import { activityPageViewAtom, hasActivityActions } from "../../../state/page";
import { ActivityPageContent } from "../../activity-page/activity-page-content";

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
      <Grid columns={{ base: 1, split: 2 }} gap={24} align="stretch">
        <Stack>
          <ActivityPageContent allowDefaultSelection />
        </Stack>
        {/* One tree shape for Review and execution: the action route below
            owns the continuation Session across them. The Review draws its
            own surface; execution keeps the primary column's. */}
        <Stack
          testId={
            isExecution ? "activity-execution-panel" : "activity-details-panel"
          }
        >
          <BackButtonProvider enabled={isExecution}>
            <Outlet />
          </BackButtonProvider>
        </Stack>
      </Grid>
    </AnimationPage>
  );
};
