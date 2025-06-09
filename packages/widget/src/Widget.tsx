import { Header } from "@sk-widget/components/molecules/header";
import { useInitParams } from "@sk-widget/hooks/use-init-params";
import { useSavedRef } from "@sk-widget/hooks/use-saved-ref";
import { useUnderMaintenance } from "@sk-widget/hooks/use-under-maintenance";
import { ActivityCompletePage } from "@sk-widget/pages/complete/pages/activity-complete.page";
import { PendingCompletePage } from "@sk-widget/pages/complete/pages/pending-complete.page";
import { StakeCompletePage } from "@sk-widget/pages/complete/pages/stake-complete.page";
import { UnstakeCompletePage } from "@sk-widget/pages/complete/pages/unstake-complete.page";
import { Layout } from "@sk-widget/pages/components/layout";
import UnderMaintenance from "@sk-widget/pages/components/under-maintenance";
import { AnimatedActivityPage } from "@sk-widget/pages/details/activity-page/activity.page";
import { Details } from "@sk-widget/pages/details/details-page/details.page";
import { AnimatedEarnPage } from "@sk-widget/pages/details/earn-page/earn.page";
import { AnimatedPositionsPage } from "@sk-widget/pages/details/positions-page/positions.page";
import { ActionReviewPage } from "@sk-widget/pages/review/pages/action-review.page";
import { PendingReviewPage } from "@sk-widget/pages/review/pages/pending-review.page";
import { UnstakeReviewPage } from "@sk-widget/pages/review/pages/unstake-review.page";
import { StakeStepsPage } from "@sk-widget/pages/steps";
import { ActivityStepsPage } from "@sk-widget/pages/steps/pages/activity-steps.page";
import { PendingStepsPage } from "@sk-widget/pages/steps/pages/pending-steps.page";
import { UnstakeStepsPage } from "@sk-widget/pages/steps/pages/unstake-steps.page";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { GlobalModals } from "./components/molecules/global-modals";
import { useDetailsMatch } from "./hooks/navigation/use-details-match";
import { useHandleDeepLinks } from "./hooks/use-handle-deep-links";
import { useIsomorphicEffect } from "./hooks/use-isomorphic-effect";
import { usePrevious } from "./hooks/use-previous";
import { ConnectedCheck } from "./navigation/cheks/connected-check";
import { AnimationLayout } from "./navigation/containers/animation-layout";
import { AnimatedFooterContent } from "./pages/components/footer-outlet";
import { headerContainer } from "./pages/components/layout/styles.css";
import { PoweredBy } from "./pages/components/powered-by";
import { PositionDetailsPage } from "./pages/position-details";
import { StakeReviewPage } from "./pages/review";
import { useSKLocation } from "./providers/location";
import { useSKWallet } from "./providers/sk-wallet";
import { container } from "./style.css";
import { MaybeWindow } from "./utils/maybe-window";

export const Widget = () => {
  const underMaintenance = useUnderMaintenance();

  const { chain, address } = useSKWallet();

  const prevChain = usePrevious(chain);
  const prevAddress = usePrevious(address);

  const { current } = useSKLocation();

  const pathnameRef = useSavedRef(current.pathname);
  const navigateRef = useSavedRef(useNavigate());

  /**
   * On chain change, navigate to home page
   */
  useIsomorphicEffect(() => {
    if (
      pathnameRef.current !== "/" &&
      pathnameRef.current !== "/positions" &&
      pathnameRef.current !== "/activity" &&
      ((prevChain && chain !== prevChain) ||
        (prevAddress && address !== prevAddress))
    ) {
      MaybeWindow.ifJust((w) => {
        const url = new URL(w.location.href);
        const newUrl = new URL(w.location.origin);
        if (url.searchParams.has("embed")) {
          newUrl.searchParams.set("embed", "true");
        }

        w.history.pushState({}, w.document.title, newUrl.href);
        navigateRef.current("/", { replace: true });
      });
    }
  }, [chain, address, pathnameRef, navigateRef, prevChain, prevAddress]);

  const initTab = useInitParams().data?.tab;

  useEffect(() => {
    if (!initTab) return;

    navigateRef.current(initTab === "earn" ? "/" : "/positions");
  }, [initTab, navigateRef]);

  useHandleDeepLinks();

  const detailsMatch = useDetailsMatch();

  /**
   * Dont unmount details page with tabs
   * Handle position details pages in their own Routes
   */
  const key = detailsMatch ? "/" : current.key;

  if (underMaintenance) return <UnderMaintenance />;

  return (
    <>
      <AnimationLayout>
        <LayoutGroup>
          <motion.div layout="position" className={headerContainer}>
            <Header />
          </motion.div>

          <motion.div layout="position" className={container}>
            <AnimatePresence>
              <Routes location={current} key={key}>
                <Route element={<Layout currentPathname={current.pathname} />}>
                  {/* Home + Tabs */}
                  <Route element={<Details />}>
                    <Route index element={<AnimatedEarnPage />} />
                    <Route
                      path="positions"
                      element={<AnimatedPositionsPage />}
                    />
                    <Route path="activity" element={<AnimatedActivityPage />} />
                  </Route>

                  <Route element={<ConnectedCheck />}>
                    {/* Activity flow */}
                    <Route path="activity">
                      <Route path="review" element={<ActionReviewPage />} />
                      <Route
                        path=":pendingActionType/steps"
                        element={<ActivityStepsPage />}
                      />
                      <Route
                        path=":pendingActionType/complete"
                        element={<ActivityCompletePage />}
                      />
                    </Route>

                    {/* Stake flow */}
                    <Route>
                      <Route path="review" element={<StakeReviewPage />} />
                      <Route path="steps" element={<StakeStepsPage />} />
                      <Route path="complete" element={<StakeCompletePage />} />
                    </Route>

                    {/* Unstake or pending actions flow */}
                    <Route path="positions/:integrationId/:balanceId">
                      <Route index element={<PositionDetailsPage />} />
                      <Route
                        path="select-validator/:pendingActionType"
                        element={<PositionDetailsPage />}
                      />

                      {/* Unstaking */}
                      <Route path="unstake">
                        <Route path="review" element={<UnstakeReviewPage />} />
                        <Route path="steps" element={<UnstakeStepsPage />} />
                        <Route
                          path="complete"
                          element={<UnstakeCompletePage />}
                        />
                      </Route>

                      {/* Pending Actions */}
                      <Route path="pending-action">
                        <Route path="review" element={<PendingReviewPage />} />
                        <Route path="steps" element={<PendingStepsPage />} />
                        <Route
                          path="complete"
                          element={<PendingCompletePage />}
                        />
                      </Route>
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </AnimatePresence>
          </motion.div>

          <AnimatedFooterContent />

          <PoweredBy />
        </LayoutGroup>
      </AnimationLayout>

      <GlobalModals />
    </>
  );
};
