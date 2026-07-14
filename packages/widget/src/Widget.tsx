import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import { GlobalModals } from "./components/molecules/global-modals";
import { Header } from "./components/molecules/header";
import { useDetailsMatch } from "./hooks/navigation/use-details-match";
import { useHandleDeepLinks } from "./hooks/use-handle-deep-links";
import { usePrevious } from "./hooks/use-previous";
import { useSavedRef } from "./hooks/use-saved-ref";
import { useUnderMaintenance } from "./hooks/use-under-maintenance";
import { ConnectedCheck } from "./navigation/cheks/connected-check";
import { AnimationLayout } from "./navigation/containers/animation-layout";
import { ActivityCompletePage } from "./pages/complete/pages/activity-complete.page";
import { PendingCompletePage } from "./pages/complete/pages/pending-complete.page";
import { StakeCompletePage } from "./pages/complete/pages/stake-complete.page";
import { UnstakeCompletePage } from "./pages/complete/pages/unstake-complete.page";
import { Layout } from "./pages/components/layout";
import { headerContainer } from "./pages/components/layout/styles.css";
import { PoweredBy } from "./pages/components/powered-by";
import UnderMaintenance from "./pages/components/under-maintenance";
import { AnimatedActivityPage } from "./pages/details/activity-page/activity.page";
import { Details } from "./pages/details/details-page/details.page";
import { AnimatedEarnPage } from "./pages/details/earn-page/earn.page";
import { AnimatedPositionsPage } from "./pages/details/positions-page/positions.page";
import { PositionDetailsPage } from "./pages/position-details";
import { StakeReviewPage } from "./pages/review";
import { ActionReviewPage } from "./pages/review/pages/action-review.page";
import { PendingReviewPage } from "./pages/review/pages/pending-review.page";
import { UnstakeReviewPage } from "./pages/review/pages/unstake-review.page";
import { StakeStepsPage } from "./pages/steps";
import { ActivityStepsPage } from "./pages/steps/pages/activity-steps.page";
import { PendingStepsPage } from "./pages/steps/pages/pending-steps.page";
import { UnstakeStepsPage } from "./pages/steps/pages/unstake-steps.page";
import { useSKLocation } from "./providers/location";
import { useSettings } from "./providers/settings";
import { useSKWallet } from "./providers/wallet/react/use-wallet";
import {
  WalletInitParamsKey,
  walletInitParamsAtom,
} from "./providers/wallet/wagmi/initialization-params";
import { container } from "./style.css";

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
  useEffect(() => {
    if (
      pathnameRef.current !== "/" &&
      pathnameRef.current !== "/positions" &&
      pathnameRef.current !== "/activity" &&
      ((prevChain && chain !== prevChain) ||
        (prevAddress && address !== prevAddress))
    ) {
      const url = new URL(window.location.href);
      const newUrl = new URL(window.location.origin);
      if (url.searchParams.has("embed")) {
        newUrl.searchParams.set("embed", "true");
      }

      window.history.pushState({}, window.document.title, newUrl.href);
      navigateRef.current("/", { replace: true });
    }
  }, [chain, address, pathnameRef, navigateRef, prevChain, prevAddress]);

  const { externalProviders } = useSettings();
  const initParams = AsyncResult.getOrElse(
    useAtomValue(
      walletInitParamsAtom(
        new WalletInitParamsKey({
          externalProviderInitToken: externalProviders?.initToken ?? null,
        })
      )
    ),
    () => null
  );
  const initTab = initParams?.tab;

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

          <PoweredBy />
        </LayoutGroup>
      </AnimationLayout>

      <GlobalModals />
    </>
  );
};

import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
