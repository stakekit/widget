import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { EarnDetails } from "../../../features/earn/composition";
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
import { useDashboardCategoryTransition } from "./dashboard-shell";

export const DashboardOverview = () => {
  const { t } = useTranslation();
  const categoryTransition = useDashboardCategoryTransition();

  return (
    // Remount on category tab clicks so they get the same enter
    // transition as switching route tabs.
    <AnimationPage key={categoryTransition}>
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
              <EarnDetails />
            </Box>
          }
        />
      </Box>
    </AnimationPage>
  );
};
