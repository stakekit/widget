import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { Box } from "../../../../shared/ui/primitives/box";
import { AnimationPage, SplitView } from "../../../widget-shell/views";
import { useBorrowWalletView } from "../../wallet/index";
import { useBorrowEntryView } from "../react/use-borrow-entry";
import { BorrowDetailsPanel } from "./components/details-panel";
import { BorrowDetailsEmpty } from "./components/notices";
import * as styles from "./styles.css";

const BorrowConnectedDetailsPane = () => {
  const view = useBorrowEntryView();

  return <BorrowDetailsPanel view={view} />;
};

/**
 * Persistent split layout for the borrow flow. The left pane swaps between the
 * form, review, steps and complete pages via the router outlet while the right
 * details pane stays mounted, mirroring the earn flow's `OverviewPage`.
 */
export const BorrowLayout = () => {
  const { t } = useTranslation();
  const walletView = useBorrowWalletView();

  return (
    <AnimationPage>
      <SplitView
        primaryBarLabel={t("dashboard.split_view.actions")}
        secondaryBarLabel={t("dashboard.split_view.details")}
        primary={
          <Box className={styles.formPane} width="0">
            <Outlet />
          </Box>
        }
        secondary={
          <Box className={styles.detailsPaneWrapper} flex={1} width="0">
            {walletView.status === "ready" ? (
              <BorrowConnectedDetailsPane />
            ) : (
              <BorrowDetailsEmpty
                title={t("dashboard.borrow.details.empty_title")}
              >
                {t("dashboard.borrow.details.empty_description")}
              </BorrowDetailsEmpty>
            )}
          </Box>
        }
      />
    </AnimationPage>
  );
};
