import { Navigate, Route, Routes } from "react-router";
import { ActivityTabPage } from "../../features/activity/ui";
import {
  BorrowCompletePage,
  BorrowConnectedWalletRoute,
  BorrowFormPage,
  BorrowLayout,
  BorrowPositionActionPage,
  BorrowPositionActionsPage,
  BorrowPositionDetailsPage,
  BorrowReviewPage,
  BorrowStepsPage,
  useBorrowFeatureEnabled,
} from "../../features/borrow/ui-entry";
import { EarnPageContent, EarnPageModelBinding } from "../../features/earn/ui";
import { ManagePage } from "../../features/portfolio/ui";
import {
  DashboardPositionDetailsPage,
  PositionDetailsActions,
  PositionDetailsStakeActions,
} from "../../features/position-details/ui";
// import { RewardsTabPage } from "../../domain/types/rewards";
import {
  ActivityDetailsPage,
  ActivityStepsPage,
  PendingCompletePage,
  PendingReviewPage,
  PendingStepsPage,
  StakeCompletePage,
  StakeReviewPage,
  StakeStepsPage,
  UnstakeCompletePage,
  UnstakeReviewPage,
  UnstakeStepsPage,
} from "../../features/transaction-flow/ui";
import { GlobalModals } from "../../features/widget-shell/screens";
import { useSKLocation } from "../../shared/react/location-history";
import { DashboardOverview } from "./dashboard-overview";
import { DashboardShell } from "./dashboard-shell";
import { ConnectedCheck } from "./guards/connected-wallet";

const positionDetailsStakeFooterPath =
  /^\/positions\/[^/]+\/[^/]+(?:\/stake)?$/;

export const shouldRegisterDashboardEarnFooterButton = (pathname: string) =>
  pathname === "/" || positionDetailsStakeFooterPath.test(pathname);

export const DashboardRoutes = () => {
  const { current } = useSKLocation();
  const borrowFeatureEnabled = useBorrowFeatureEnabled();
  const registerEarnFooterButton = shouldRegisterDashboardEarnFooterButton(
    current.pathname
  );
  const borrowRoutes = borrowFeatureEnabled ? (
    <>
      <Route path="borrow" element={<BorrowLayout />}>
        <Route index element={<BorrowFormPage />} />
        <Route element={<BorrowConnectedWalletRoute />}>
          <Route path="review" element={<BorrowReviewPage />} />
          <Route path="steps" element={<BorrowStepsPage />} />
          <Route path="complete" element={<BorrowCompletePage />} />
        </Route>
      </Route>
      <Route element={<BorrowConnectedWalletRoute />}>
        <Route
          path="positions/borrow/:marketId"
          element={<BorrowPositionDetailsPage />}
        >
          <Route index element={<BorrowPositionActionsPage />} />
          <Route
            path="action/:actionId"
            element={<BorrowPositionActionPage />}
          />
          <Route path="review" element={<BorrowReviewPage />} />
          <Route path="steps" element={<BorrowStepsPage />} />
          <Route path="complete" element={<BorrowCompletePage />} />
        </Route>
      </Route>
    </>
  ) : (
    <>
      <Route path="borrow/*" element={<Navigate to="/" replace />} />
      <Route
        path="positions/borrow/:marketId/*"
        element={<Navigate to="/manage" replace />}
      />
    </>
  );

  return (
    <>
      <EarnPageModelBinding registerFooterButton={registerEarnFooterButton}>
        <Routes>
          <Route element={<DashboardShell />}>
            {/* Earn Tab */}
            <Route element={<DashboardOverview />}>
              <Route index element={<EarnPageContent />} />

              <Route element={<ConnectedCheck />}>
                <Route path="review" element={<StakeReviewPage />} />
                <Route path="steps" element={<StakeStepsPage />} />
                <Route path="complete" element={<StakeCompletePage />} />
              </Route>
            </Route>

            {/* Manage Tab */}
            <Route path="manage" element={<ManagePage />} />

            {/* Borrow Tab */}
            {borrowRoutes}

            {/* Position Details */}
            <Route
              path="positions/:integrationId/:balanceId"
              element={<DashboardPositionDetailsPage />}
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
                element={<DashboardPositionDetailsPage />}
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
      </EarnPageModelBinding>

      <GlobalModals />
    </>
  );
};
