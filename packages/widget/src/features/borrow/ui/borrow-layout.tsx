import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { VerticalDivider } from "../../../shared/ui/components/divider";
import { Box } from "../../../shared/ui/primitives/box";
import { AnimationPage, TabPageContainer } from "../../widget-shell/components";
import { useBorrowDashboardView } from "../react/use-borrow-dashboard";
import { useBorrowWalletBridge } from "../react/use-borrow-wallet-bridge";
import { BorrowDetailsPanel } from "./components/borrow-details-panel";
import { BorrowDetailsEmpty } from "./components/notices";
import * as styles from "./styles.css";

const BorrowConnectedDetailsPane = () => {
  const view = useBorrowDashboardView();

  return <BorrowDetailsPanel view={view} />;
};

/**
 * Persistent split layout for the borrow flow. The left pane swaps between the
 * form, review, steps and complete pages via the router outlet while the right
 * details pane stays mounted, mirroring the earn flow's `OverviewPage`.
 */
export const BorrowLayout = () => {
  const { t } = useTranslation();
  const walletBridge = useBorrowWalletBridge();

  return (
    <AnimationPage>
      <TabPageContainer>
        <Box className={styles.formPane} width="0">
          <Outlet />
        </Box>

        <VerticalDivider />

        <Box className={styles.detailsPaneWrapper} flex={1} width="0">
          {walletBridge.status === "connected" ? (
            <BorrowConnectedDetailsPane />
          ) : (
            <BorrowDetailsEmpty
              title={t("dashboard.borrow.details.empty_title")}
            >
              {t("dashboard.borrow.details.empty_description")}
            </BorrowDetailsEmpty>
          )}
        </Box>
      </TabPageContainer>
    </AnimationPage>
  );
};
