import { Navigate, Route, Routes } from "react-router";
import { ActivityTabPage } from "../../features/activity/ui/dashboard/activity";
import { BorrowFormPage, BorrowLayout } from "../../features/borrow/ui";
import { BorrowConnectedWalletRoute } from "../../features/borrow/ui/connected-wallet";
import {
  BorrowPositionActionPage,
  BorrowPositionActionsPage,
  BorrowPositionDetailsPage,
} from "../../features/borrow/ui/position-details";
import { useBorrowFeatureEnabled } from "../../features/borrow/ui/use-borrow-feature-enabled";
import {
  BorrowCompletePage,
  BorrowReviewPage,
  BorrowStepsPage,
  BorrowTransactionFlowCompletionGuard,
  BorrowTransactionFlowExecutionScope,
  BorrowTransactionFlowReviewRoute,
  BorrowTransactionFlowRoute,
} from "../../features/borrow-transaction-flow/ui";
// import { RewardsTabPage } from "../../domain/types/rewards";
import {
  ActivityResumeClassicFlowRoute,
  ClassicFlowExecutionScope,
  ClassicFlowReviewScope,
  EnterClassicFlowRoute,
  ExitClassicFlowRoute,
  ManageClassicFlowRoute,
} from "../../features/classic-transaction-flow/react/classic-flow-route";
import { ActivityDetailsPage } from "../../features/classic-transaction-flow/ui/activity-details.page";
import { PendingCompletePage } from "../../features/classic-transaction-flow/ui/complete/pages/pending-complete.page";
import { StakeCompletePage } from "../../features/classic-transaction-flow/ui/complete/pages/stake-complete.page";
import { UnstakeCompletePage } from "../../features/classic-transaction-flow/ui/complete/pages/unstake-complete.page";
import { PendingReviewPage } from "../../features/classic-transaction-flow/ui/review/pages/pending-review.page";
import { StakeReviewPage } from "../../features/classic-transaction-flow/ui/review/pages/stake-review.page";
import { UnstakeReviewPage } from "../../features/classic-transaction-flow/ui/review/pages/unstake-review.page";
import { ActivityStepsPage } from "../../features/classic-transaction-flow/ui/steps/pages/activity-steps.page";
import { PendingStepsPage } from "../../features/classic-transaction-flow/ui/steps/pages/pending-steps.page";
import { StakeStepsPage } from "../../features/classic-transaction-flow/ui/steps/pages/stake-steps.page";
import { UnstakeStepsPage } from "../../features/classic-transaction-flow/ui/steps/pages/unstake-steps.page";
import { EarnPageModelBinding } from "../../features/earn/ui/classic/earn-page/state/earn-page-model";
import { EarnPageContent } from "../../features/earn/ui/dashboard/earn-page";
import { ManagePage } from "../../features/portfolio/ui/dashboard/manage.page";
import { PositionDetailsPage as DashboardPositionDetailsPage } from "../../features/position-details/ui/dashboard";
import { PositionDetailsActions } from "../../features/position-details/ui/dashboard/components/position-details-actions";
import { PositionDetailsStakeActions } from "../../features/position-details/ui/dashboard/components/position-details-stake-actions";
import { WalletScopeRouteGuard } from "../../features/wallet/react/wallet-scope-route";
import { GlobalModals } from "../../features/widget-shell/ui/global-modals";
import { useSKLocation } from "../../shared/react/location-history";
import { DashboardOverview } from "./dashboard-overview";
import { DashboardShell } from "./dashboard-shell";

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
        <Route element={<WalletScopeRouteGuard fallbackPath="/borrow" />}>
          <Route element={<BorrowConnectedWalletRoute />}>
            <Route
              element={
                <BorrowTransactionFlowRoute expected="BorrowDashboard" />
              }
            >
              <Route element={<BorrowTransactionFlowReviewRoute />}>
                <Route path="review" element={<BorrowReviewPage />} />
              </Route>
              <Route element={<BorrowTransactionFlowExecutionScope />}>
                <Route path="steps" element={<BorrowStepsPage />} />
                <Route element={<BorrowTransactionFlowCompletionGuard />}>
                  <Route path="complete" element={<BorrowCompletePage />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
      <Route element={<WalletScopeRouteGuard fallbackPath="/borrow" />}>
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
            <Route
              element={<BorrowTransactionFlowRoute expected="BorrowPosition" />}
            >
              <Route element={<BorrowTransactionFlowReviewRoute />}>
                <Route path="review" element={<BorrowReviewPage />} />
              </Route>
              <Route element={<BorrowTransactionFlowExecutionScope />}>
                <Route path="steps" element={<BorrowStepsPage />} />
                <Route element={<BorrowTransactionFlowCompletionGuard />}>
                  <Route path="complete" element={<BorrowCompletePage />} />
                </Route>
              </Route>
            </Route>
          </Route>
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

              <Route element={<WalletScopeRouteGuard fallbackPath="/" />}>
                <Route element={<EnterClassicFlowRoute />}>
                  <Route
                    path="review"
                    element={
                      <ClassicFlowReviewScope>
                        <StakeReviewPage />
                      </ClassicFlowReviewScope>
                    }
                  />
                  <Route element={<ClassicFlowExecutionScope />}>
                    <Route path="steps" element={<StakeStepsPage />} />
                    <Route path="complete" element={<StakeCompletePage />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            {/* Manage Tab */}
            <Route path="manage" element={<ManagePage />} />

            {/* Borrow Tab */}
            {borrowRoutes}

            {/* Position Details */}
            <Route element={<WalletScopeRouteGuard fallbackPath="/manage" />}>
              <Route
                path="positions/:integrationId/:balanceId"
                element={<DashboardPositionDetailsPage />}
              >
                <Route index element={<PositionDetailsStakeActions />} />

                {/* Staking */}
                <Route path="stake">
                  <Route index element={<PositionDetailsStakeActions />} />
                  <Route element={<EnterClassicFlowRoute />}>
                    <Route
                      path="review"
                      element={
                        <ClassicFlowReviewScope>
                          <StakeReviewPage />
                        </ClassicFlowReviewScope>
                      }
                    />
                    <Route element={<ClassicFlowExecutionScope />}>
                      <Route path="steps" element={<StakeStepsPage />} />
                      <Route path="complete" element={<StakeCompletePage />} />
                    </Route>
                  </Route>
                </Route>

                <Route
                  path="select-validator/:pendingActionType"
                  element={<DashboardPositionDetailsPage />}
                />

                {/* Unstaking */}
                <Route path="unstake">
                  <Route index element={<PositionDetailsActions />} />
                  <Route element={<ExitClassicFlowRoute />}>
                    <Route
                      path="review"
                      element={
                        <ClassicFlowReviewScope>
                          <UnstakeReviewPage />
                        </ClassicFlowReviewScope>
                      }
                    />
                    <Route element={<ClassicFlowExecutionScope />}>
                      <Route path="steps" element={<UnstakeStepsPage />} />
                      <Route
                        path="complete"
                        element={<UnstakeCompletePage />}
                      />
                    </Route>
                  </Route>
                </Route>

                {/* Pending Actions */}
                <Route path="pending-action">
                  <Route element={<ManageClassicFlowRoute />}>
                    <Route
                      path="review"
                      element={
                        <ClassicFlowReviewScope>
                          <PendingReviewPage />
                        </ClassicFlowReviewScope>
                      }
                    />
                    <Route element={<ClassicFlowExecutionScope />}>
                      <Route path="steps" element={<PendingStepsPage />} />
                      <Route
                        path="complete"
                        element={<PendingCompletePage />}
                      />
                    </Route>
                  </Route>
                </Route>
              </Route>
            </Route>

            {/* Rewards Tab */}
            {/* <Route path="rewards" element={<RewardsTabPage />} /> */}

            {/* Activity Tab */}
            <Route path="activity" element={<ActivityTabPage />}>
              <Route
                element={<WalletScopeRouteGuard fallbackPath="/activity" />}
              >
                <Route element={<ActivityResumeClassicFlowRoute />}>
                  <Route index element={<ActivityDetailsPage />} />
                  <Route element={<ClassicFlowExecutionScope />}>
                    <Route
                      path=":pendingActionType/steps"
                      element={<ActivityStepsPage />}
                    />
                  </Route>
                </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
      </EarnPageModelBinding>

      <GlobalModals />
    </>
  );
};
