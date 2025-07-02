import { Route, Routes } from "react-router";
import { GlobalModals } from "./components/molecules/global-modals";
import { ConnectedCheck } from "./navigation/cheks/connected-check";
// import { RewardsTabPage } from "./pages-dashboard/rewards";
import { PendingCompletePage } from "./pages/complete/pages/pending-complete.page";
import { StakeCompletePage } from "./pages/complete/pages/stake-complete.page";
import { UnstakeCompletePage } from "./pages/complete/pages/unstake-complete.page";
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
import { EarnPage } from "./pages-dashboard/overview/earn-page";
import { PositionDetailsPage } from "./pages-dashboard/position-details";
import { PositionDetailsActions } from "./pages-dashboard/position-details/components/position-details-actions";

export const Dashboard = () => {
  return (
    <>
      <Routes>
        <Route element={<DashboardWrapper />}>
          {/* Overview Tab */}
          <Route element={<OverviewPage />}>
            <Route index element={<EarnPage />} />

            <Route element={<ConnectedCheck />}>
              <Route path="review" element={<StakeReviewPage />} />
              <Route path="steps" element={<StakeStepsPage />} />
              <Route path="complete" element={<StakeCompletePage />} />
            </Route>
          </Route>

          {/* Position Details */}
          <Route
            path="positions/:integrationId/:balanceId"
            element={<PositionDetailsPage />}
          >
            <Route index element={<PositionDetailsActions />} />

            <Route
              path="select-validator/:pendingActionType"
              element={<PositionDetailsPage />}
            />

            {/* Unstaking */}
            <Route path="unstake">
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

      <GlobalModals />
    </>
  );
};
