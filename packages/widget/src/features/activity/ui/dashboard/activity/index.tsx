import { useAtomValue } from "@effect/atom-react";
import { Outlet, useMatch } from "react-router";
import { Box } from "../../../../../shared/ui/primitives/box";
import { useSKWallet } from "../../../../wallet/index";
import {
  AnimationPage,
  BackButtonProvider,
} from "../../../../widget-shell/views";
import {
  activityPageViewAtom,
  shouldShowActivityDashboardSplit,
} from "../../../state/page";
import { ActivityPageContent } from "../../activity-page/activity-page-content";
import * as styles from "./styles.css";

export const ActivityTabPage = () => {
  const wallet = useSKWallet();
  const view = useAtomValue(activityPageViewAtom);
  const stepsMatch = useMatch("/activity/:actionId/steps");
  const completeMatch = useMatch("/activity/:actionId/complete");
  const isExecution = stepsMatch !== null || completeMatch !== null;
  const showSplit =
    wallet?.status === "connected" && shouldShowActivityDashboardSplit(view);

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
          {isExecution ? (
            <BackButtonProvider>
              <Outlet />
            </BackButtonProvider>
          ) : (
            <Outlet />
          )}
        </Box>
      </Box>
    </AnimationPage>
  );
};
