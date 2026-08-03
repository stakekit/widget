import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { Box } from "../../components/atoms/box";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { BackButtonProvider } from "../common/components/back-button";
import { SplitView } from "../common/components/split-view";
import { EarnDetails } from "./earn-details";
import { earnDetailsWrapper } from "./earn-details/styles.css";
import { overviewPageContainer } from "./styles.css";

export const OverviewPage = () => {
  const { t } = useTranslation();

  return (
    <AnimationPage>
      <Box display="flex" flexDirection="column" gap="4">
        <SplitView
          primaryBarLabel={t("dashboard.split_view.earn")}
          secondaryBarLabel={t("dashboard.split_view.details")}
          primary={
            <Box
              display="flex"
              flex={1}
              flexDirection="column"
              gap="8"
              width="0"
              className={overviewPageContainer}
              justifyContent="space-between"
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
