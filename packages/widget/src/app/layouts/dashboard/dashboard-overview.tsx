import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import {
  EarnDetails,
  EarnFlowDetails,
} from "../../../features/earn/composition";
import {
  AnimationPage,
  BackButtonProvider,
  SplitView,
} from "../../../features/widget-shell/views";
import { Box } from "../../../shared/ui/primitives/box";
import {
  earnDetailsWrapper,
  overviewPageContainer,
} from "./dashboard-overview.css";

/**
 * Stable parent of the Earn form and its flow routes, so moving from the form
 * into Review does not replay the page transition.
 */
export const DashboardEarnTab = () => (
  <AnimationPage>
    <Outlet />
  </AnimationPage>
);

/** The Earn form beside the details of its live selection. */
export const DashboardOverview = () => (
  <DashboardOverviewSplitView details={<EarnDetails />} />
);

/**
 * A started Earn flow beside the details of the target it executes against.
 * Rendered inside the flow's Session, which owns that target.
 */
export const DashboardEarnFlowOverview = () => (
  <DashboardOverviewSplitView details={<EarnFlowDetails />} />
);

const DashboardOverviewSplitView = ({
  details,
}: {
  readonly details: ReactNode;
}) => {
  const { t } = useTranslation();

  return (
    <Box display="flex" flexDirection="column" gap="4">
      <SplitView
        primaryBarLabel={t("dashboard.split_view.earn")}
        secondaryBarLabel={t("dashboard.split_view.details")}
        primary={
          <Box
            className={overviewPageContainer}
            display="flex"
            flex={1}
            flexDirection="column"
            gap="8"
            justifyContent="space-between"
            width="0"
          >
            <BackButtonProvider>
              <Outlet />
            </BackButtonProvider>
          </Box>
        }
        secondary={
          <Box className={earnDetailsWrapper} flex={1} width="0">
            {details}
          </Box>
        }
      />
    </Box>
  );
};
