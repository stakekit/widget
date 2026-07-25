import { Navigate, Route, Routes, useLocation } from "react-router";
import { ActivityTabPage } from "../../features/activity/ui";
import { useBorrowFeatureEnabled } from "../../features/borrow/state";
import {
  BorrowConnectedWalletRoute,
  BorrowFormPage,
  BorrowLayout,
  BorrowPositionActionPage,
  BorrowPositionActionsPage,
  BorrowPositionDetailsPage,
} from "../../features/borrow/ui";
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
  ActivityDetailsPage,
  ActivityResumeClassicFlowRoute,
  ActivityStepsPage,
  ClassicFlowExecutionScope,
  ClassicFlowReviewScope,
  EnterClassicFlowRoute,
  ExitClassicFlowRoute,
  ManageClassicFlowRoute,
  PendingCompletePage,
  PendingReviewPage,
  PendingStepsPage,
  StakeCompletePage,
  StakeReviewPage,
  StakeStepsPage,
  UnstakeCompletePage,
  UnstakeReviewPage,
  UnstakeStepsPage,
} from "../../features/classic-transaction-flow/ui";
import { EarnPageContent } from "../../features/earn/ui";
import { ManagePage } from "../../features/portfolio/ui";
import {
  DashboardPositionDetailsPage,
  PositionDetailsActions,
  PositionDetailsStakeActions,
} from "../../features/position-details/ui";
import { WalletScopeRouteGuard } from "../../features/wallet/ui";
import { GlobalModals } from "../../features/widget-shell/ui";
import { DashboardOverview } from "./dashboard-overview";
import { DashboardShell } from "./dashboard-shell";

const positionDetailsStakeFooterPath =
  /^\/positions\/[^/]+\/[^/]+(?:\/stake)?$/;

export const shouldRegisterDashboardEarnFooterButton = (pathname: string) =>
  pathname === "/" || positionDetailsStakeFooterPath.test(pathname);

export const DashboardRoutes = () => {
  const location = useLocation();
  const borrowFeatureEnabled = useBorrowFeatureEnabled();
  const registerEarnFooterButton = shouldRegisterDashboardEarnFooterButton(
    location.pathname
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
      <Routes>
        <Route element={<DashboardShell />}>
          {/* Earn Tab */}
          <Route element={<DashboardOverview />}>
            <Route
              index
              element={
                <EarnPageContent
                  registerFooterButton={registerEarnFooterButton}
                />
              }
            />

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
                    <Route path="complete" element={<UnstakeCompletePage />} />
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
                    <Route path="complete" element={<PendingCompletePage />} />
                  </Route>
                </Route>
              </Route>
            </Route>
          </Route>

          {/* Rewards Tab */}
          {/* <Route path="rewards" element={<RewardsTabPage />} /> */}

          {/* Activity Tab */}
          <Route path="activity" element={<ActivityTabPage />}>
            <Route element={<WalletScopeRouteGuard fallbackPath="/activity" />}>
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

      <GlobalModals />
    </>
  );
};
