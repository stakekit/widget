import { Route, Routes } from "react-router";
import { GlobalModals } from "./components/molecules/global-modals";
import { ConnectedCheck } from "./navigation/cheks/connected-check";
// import { RewardsTabPage } from "./pages-dashboard/rewards";
import { PendingCompletePage } from "./pages/complete/pages/pending-complete.page";
import { StakeCompletePage } from "./pages/complete/pages/stake-complete.page";
import { UnstakeCompletePage } from "./pages/complete/pages/unstake-complete.page";
import { EarnPageContextProvider } from "./pages/details/earn-page/state/earn-page-context";
import { StakeReviewPage } from "./pages/review";
import { PendingReviewPage } from "./pages/review/pages/pending-review.page";
import { UnstakeReviewPage } from "./pages/review/pages/unstake-review.page";
import { StakeStepsPage } from "./pages/steps";
import { ActivityStepsPage } from "./pages/steps/pages/activity-steps.page";
import { PendingStepsPage } from "./pages/steps/pages/pending-steps.page";
import { UnstakeStepsPage } from "./pages/steps/pages/unstake-steps.page";
import { ActivityTabPage } from "./pages-dashboard/activity";
import { ActivityDetailsPage } from "./pages-dashboard/activity/activity-details.page";
import { DashboardWrapper } from "./pages-dashboard/common/components/wrapper";
import { OverviewPage } from "./pages-dashboard/overview";
import { EarnPageContent } from "./pages-dashboard/overview/earn-page";
import { ManagePage } from "./pages-dashboard/overview/manage.page";
import { PositionDetailsPage } from "./pages-dashboard/position-details";
import { PositionDetailsActions } from "./pages-dashboard/position-details/components/position-details-actions";
import { PositionDetailsStakeActions } from "./pages-dashboard/position-details/components/position-details-stake-actions";
import { DashboardProvider } from "./pages-dashboard/providers/dashboard-context";
import { useSKLocation } from "./providers/location";

const positionDetailsStakeFooterPath =
  /^\/positions\/[^/]+\/[^/]+(?:\/stake)?$/;

export const shouldRegisterDashboardEarnFooterButton = (pathname: string) =>
  pathname === "/" || positionDetailsStakeFooterPath.test(pathname);

export const Dashboard = () => {
  const { current } = useSKLocation();
  const registerEarnFooterButton = shouldRegisterDashboardEarnFooterButton(
    current.pathname
  );

  return (
    <DashboardProvider>
      <EarnPageContextProvider registerFooterButton={registerEarnFooterButton}>
        <Routes>
          <Route element={<DashboardWrapper />}>
            {/* Earn Tab */}
            <Route element={<OverviewPage />}>
              <Route index element={<EarnPageContent />} />

              <Route element={<ConnectedCheck />}>
                <Route path="review" element={<StakeReviewPage />} />
                <Route path="steps" element={<StakeStepsPage />} />
                <Route path="complete" element={<StakeCompletePage />} />
              </Route>
            </Route>

            {/* Manage Tab */}
            <Route path="manage" element={<ManagePage />} />

            {/* Position Details */}
            <Route
              path="positions/:integrationId/:balanceId"
              element={<PositionDetailsPage />}
            >
              <Route index element={<PositionDetailsStakeActions />} />

              {/* Staking */}
              <Route path="stake">
                <Route index element={<PositionDetailsStakeActions />} />
                <Route path="review" element={<StakeReviewPage />} />
                <Route path="steps" element={<StakeStepsPage />} />
                <Route path="complete" element={<StakeCompletePage />} />
              </Route>

              <Route
                path="select-validator/:pendingActionType"
                element={<PositionDetailsPage />}
              />

              {/* Unstaking */}
              <Route path="unstake">
                <Route index element={<PositionDetailsActions />} />
                <Route path="review" element={<UnstakeReviewPage />} />
                <Route path="steps" element={<UnstakeStepsPage />} />
                <Route path="complete" element={<UnstakeCompletePage />} />
              </Route>

              {/* Pending Actions */}
              <Route path="pending-action">
                <Route path="review" element={<PendingReviewPage />} />
                <Route path="steps" element={<PendingStepsPage />} />
                <Route path="complete" element={<PendingCompletePage />} />
              </Route>
            </Route>

            {/* Rewards Tab */}
            {/* <Route path="rewards" element={<RewardsTabPage />} /> */}

            {/* Activity Tab */}
            <Route path="activity" element={<ActivityTabPage />}>
              <Route index element={<ActivityDetailsPage />} />
              <Route
                path=":pendingActionType/steps"
                element={<ActivityStepsPage />}
              />
            </Route>
          </Route>
        </Routes>
      </EarnPageContextProvider>

      <GlobalModals />
    </DashboardProvider>
  );
};
