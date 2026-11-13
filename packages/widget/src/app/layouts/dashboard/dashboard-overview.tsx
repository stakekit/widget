import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";

import {
  EarnCampaignOffer,
  EarnDetails,
  EarnFlowDetails,
} from "../../../features/earn/composition";
import {
  AnimationPage,
  BackButtonProvider,
} from "../../../features/widget-shell/views";
import { SplitView, Stack } from "../../../ui/index";

/**
 * Stable parent of the Earn form and its flow routes, so moving from the form
 * into Review does not replay the page transition.
 */
export const DashboardEarnTab = () => (
  <AnimationPage>
    <Outlet />
  </AnimationPage>
);

/**
 * The Earn form beside the details of its live selection, under the Campaign
 * Offer, if any.
 */
export const DashboardOverview = () => (
  <Stack grow gap={16}>
    <EarnCampaignOffer />
    <DashboardOverviewSplitView details={<EarnDetails />} />
  </Stack>
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
    <SplitView
      secondaryLabel={t("dashboard.split_view.details")}
      primary={
        <Stack grow gap={32} justify="between">
          <BackButtonProvider>
            <Outlet />
          </BackButtonProvider>
        </Stack>
      }
      secondary={details}
    />
  );
};
