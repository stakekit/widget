import { ConnectedCheck } from "@sk-widget/navigation/cheks/connected-check";
import { ActivityTabPage } from "@sk-widget/pages-dashboard/activity";
import { ActivityDetailsPage } from "@sk-widget/pages-dashboard/activity/activity-details.page";
import { DashboardWrapper } from "@sk-widget/pages-dashboard/common/components/wrapper";
import { OverviewPage } from "@sk-widget/pages-dashboard/overview";
import { EarnPage } from "@sk-widget/pages-dashboard/overview/earn-page";
import { PositionDetailsPage } from "@sk-widget/pages-dashboard/position-details";
import { PositionDetailsActions } from "@sk-widget/pages-dashboard/position-details/components/position-details-actions";
// import { RewardsTabPage } from "@sk-widget/pages-dashboard/rewards";
import { PendingCompletePage } from "@sk-widget/pages/complete/pages/pending-complete.page";
import { StakeCompletePage } from "@sk-widget/pages/complete/pages/stake-complete.page";
import { UnstakeCompletePage } from "@sk-widget/pages/complete/pages/unstake-complete.page";
import { StakeReviewPage } from "@sk-widget/pages/review";
import { PendingReviewPage } from "@sk-widget/pages/review/pages/pending-review.page";
import { UnstakeReviewPage } from "@sk-widget/pages/review/pages/unstake-review.page";
import { StakeStepsPage } from "@sk-widget/pages/steps";
import { ActivityStepsPage } from "@sk-widget/pages/steps/pages/activity-steps.page";
import { PendingStepsPage } from "@sk-widget/pages/steps/pages/pending-steps.page";
import { UnstakeStepsPage } from "@sk-widget/pages/steps/pages/unstake-steps.page";
import { Route, Routes } from "react-router";

export const Dashboard = () => {
  return (
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
  );
};
