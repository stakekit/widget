import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { EarnDetails } from "../../features/earn/ui";
import {
  AnimationPage,
  BackButtonProvider,
  SplitView,
} from "../../features/widget-shell/components";
import { Box } from "../../shared/ui/primitives/box";
import {
  earnDetailsWrapper,
  overviewPageContainer,
} from "./dashboard-overview.css";

export const DashboardOverview = () => {
  const { t } = useTranslation();

  return (
    <AnimationPage>
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
