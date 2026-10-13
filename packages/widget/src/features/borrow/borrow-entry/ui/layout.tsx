import { useAtomValue } from "@effect/atom-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { Box } from "../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../shared/ui/primitives/content-loader";
import {
  type BorrowEntryFlowDetails,
  useBorrowTransactionFlow,
} from "../../../borrow-transaction-flow/index";
import { AnimationPage, SplitView } from "../../../widget-shell/views";
import { useBorrowWalletView } from "../../wallet/index";
import { useBorrowEntryView } from "../react/use-borrow-entry";
import { borrowFlowDetailsAtom } from "../state/flow-details";
import {
  BorrowEntryDetailsPanel,
  BorrowMarketDetails,
} from "./components/details-panel";
import { BorrowDetailsEmpty } from "./components/notices";
import * as styles from "./styles.css";

/**
 * Stays mounted across the form and the flow, so moving between their split
 * layouts does not replay the page animation.
 */
export const BorrowShell = () => (
  <AnimationPage>
    <Outlet />
  </AnimationPage>
);

const BorrowSplitView = ({ details }: { readonly details: ReactNode }) => {
  const { t } = useTranslation();

  return (
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
          {details}
        </Box>
      }
    />
  );
};

const BorrowConnectedEntryDetails = () => (
  <BorrowEntryDetailsPanel view={useBorrowEntryView()} />
);

/** The entry form beside the details of its live market selection. */
export const BorrowEntryLayout = () => {
  const { t } = useTranslation();
  const walletView = useBorrowWalletView();

  const getDetails = (): ReactNode => {
    if (walletView.status === "ready") return <BorrowConnectedEntryDetails />;
    if (walletView.status === "connecting") {
      return <ContentLoaderSquare heightPx={430} />;
    }
    return (
      <BorrowDetailsEmpty title={t("dashboard.borrow.details.empty_title")}>
        {t("dashboard.borrow.details.empty_description")}
      </BorrowDetailsEmpty>
    );
  };

  return <BorrowSplitView details={getDetails()} />;
};

const BorrowFlowDetails = ({
  captured,
}: {
  readonly captured: BorrowEntryFlowDetails;
}) => {
  const details = useAtomValue(borrowFlowDetailsAtom(captured));

  return (
    <BorrowMarketDetails
      collateralToken={details.collateralToken}
      integration={details.integration}
      market={details.market}
    />
  );
};

/**
 * Review, steps and complete beside the market the flow started on, never the
 * entry form's current selection.
 */
export const BorrowFlowLayout = () => {
  const { entry } = useBorrowTransactionFlow().intake;

  return (
    <BorrowSplitView
      details={
        entry._tag === "BorrowEntry" ? (
          <BorrowFlowDetails captured={entry.details} />
        ) : null
      }
    />
  );
};
