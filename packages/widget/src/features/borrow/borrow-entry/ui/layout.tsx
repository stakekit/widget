import { useAtomValue } from "@effect/atom-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { exactDecimal } from "../../../../domain/finance/exact";
import { EmptyState, SplitView, Stack } from "../../../../ui/index";
import {
  type BorrowEntryFlowDetails,
  useBorrowTransactionFlow,
} from "../../../borrow-transaction-flow/index";
import { AnimationPage } from "../../../widget-shell/views";
import { useBorrowWalletView } from "../../wallet/index";
import { useBorrowEntryView } from "../react/use-borrow-entry";
import { borrowFlowDetailsAtom } from "../state/flow-details";
import {
  BorrowEntryDetailsPanel,
  BorrowMarketDetails,
} from "./components/details-panel";
import { BorrowDetailsSkeleton } from "./components/skeletons";

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
      secondaryLabel={t("dashboard.split_view.details")}
      primary={
        <Stack gap={8} grow>
          <Outlet />
        </Stack>
      }
      secondary={details}
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
      return <BorrowDetailsSkeleton />;
    }
    return (
      <EmptyState
        title={t("dashboard.borrow.details.empty_title")}
        body={t("dashboard.borrow.details.empty_description")}
      />
    );
  };

  return <BorrowSplitView details={getDetails()} />;
};

const BorrowFlowDetails = ({
  captured,
  projectedMaxLtv,
}: {
  readonly captured: BorrowEntryFlowDetails;
  readonly projectedMaxLtv: string | undefined;
}) => {
  const details = useAtomValue(borrowFlowDetailsAtom(captured));

  return (
    <BorrowMarketDetails
      collateralToken={details.collateralToken}
      integration={details.integration}
      market={details.market}
      {...(projectedMaxLtv === undefined
        ? {}
        : { projectedMaxLtv: exactDecimal(projectedMaxLtv) })}
    />
  );
};

/**
 * Review, steps and complete beside the market the flow started on, never the
 * entry form's current selection, with the max LTV the flow projected so the
 * card reads the same limit as Review's LTV meter.
 */
export const BorrowFlowLayout = () => {
  const { entry, summary } = useBorrowTransactionFlow().intake;
  const projectedMaxLtv =
    summary.riskStatus === "available" ? summary.maxLtv : undefined;

  return (
    <BorrowSplitView
      details={
        entry._tag === "BorrowEntry" ? (
          <BorrowFlowDetails
            captured={entry.details}
            projectedMaxLtv={projectedMaxLtv}
          />
        ) : null
      }
    />
  );
};
