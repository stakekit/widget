import "@stakekit/rainbowkit/styles.css";
import "./translation";
import "./utils/extend-purify";
import "./styles/theme/global.css";
import { useInitParams } from "@sk-widget/hooks/use-init-params";
import { useUnderMaintenance } from "@sk-widget/hooks/use-under-maintenance";
import { ActivityCompletePage } from "@sk-widget/pages/complete/pages/activity-complete.page";
import { PendingCompletePage } from "@sk-widget/pages/complete/pages/pending-complete.page";
import { UnstakeCompletePage } from "@sk-widget/pages/complete/pages/unstake-complete.page";
import UnderMaintenance from "@sk-widget/pages/components/under-maintenance";
import { ActivityPage } from "@sk-widget/pages/details/activity-page/activity.page";
import { ActionReviewPage } from "@sk-widget/pages/review/pages/action-review.page";
import { PendingReviewPage } from "@sk-widget/pages/review/pages/pending-review.page";
import { UnstakeReviewPage } from "@sk-widget/pages/review/pages/unstake-review.page";
import { ActivityStepsPage } from "@sk-widget/pages/steps/pages/activity-steps.page";
import { PendingStepsPage } from "@sk-widget/pages/steps/pages/pending-steps.page";
import { UnstakeStepsPage } from "@sk-widget/pages/steps/pages/unstake-steps.page";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Navigate,
  Route,
  RouterProvider,
  Routes,
  createMemoryRouter,
  useNavigate,
} from "react-router-dom";
import { preloadImages } from "./assets/images";
import { Box, Header } from "./components";
import { GlobalModals } from "./components/molecules/global-modals";
import { useSavedRef, useToggleTheme } from "./hooks";
import { useDetailsMatch } from "./hooks/navigation/use-details-match";
import { useHandleDeepLinks } from "./hooks/use-handle-deep-links";
import { useIsomorphicEffect } from "./hooks/use-isomorphic-effect";
import { usePrevious } from "./hooks/use-previous";
import { ConnectedCheck } from "./navigation/cheks/connected-check";
import { AnimationLayout } from "./navigation/containers/animation-layout";
import {
  Details,
  EarnPage,
  Layout,
  PositionsPage,
  StakeCompletePage,
  StakeStepsPage,
} from "./pages";
import { FooterContent } from "./pages/components/footer-outlet";
import { headerContainer } from "./pages/components/layout/styles.css";
import { PoweredBy } from "./pages/components/powered-by";
import { PositionDetailsPage } from "./pages/position-details";
import { StakeReviewPage } from "./pages/review";
import { Providers } from "./providers";
import { useSKLocation } from "./providers/location";
import type { SettingsProps, VariantProps } from "./providers/settings";
import { SettingsContextProvider } from "./providers/settings";
import { useSKWallet } from "./providers/sk-wallet";
import { appContainer, container } from "./style.css";
import { useLoadErrorTranslations } from "./translation";
import { MaybeWindow } from "./utils/maybe-window";

preloadImages();

const Widget = () => {
  useToggleTheme();

  const underMaintenance = useUnderMaintenance();

  useLoadErrorTranslations();

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
  const key = detailsMatch ? "/" : current.pathname;

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
                    <Route index element={<EarnPage />} />
                    <Route path="positions" element={<PositionsPage />} />
                    <Route path="activity" element={<ActivityPage />} />
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

          <FooterContent />

          <PoweredBy />
        </LayoutGroup>
      </AnimationLayout>

      <GlobalModals />
    </>
  );
};

const Root = () => {
  const [showChild, setShowChild] = useState(false);

  useIsomorphicEffect(() => setShowChild(true), []); // ssr disabled

  return <Providers>{showChild && <Widget />}</Providers>;
};

export type SKAppProps = SettingsProps & (VariantProps | { variant?: never });

export const SKApp = (props: SKAppProps) => {
  const variantProps: VariantProps =
    !props.variant || props.variant === "default"
      ? { variant: "default" }
      : { variant: props.variant, chainModal: props.chainModal };

  const [router] = useState(() =>
    createMemoryRouter([{ path: "*", Component: Root }])
  );

  return (
    <SettingsContextProvider {...variantProps} {...props}>
      <Box className={appContainer}>
        <RouterProvider router={router} />
      </Box>
    </SettingsContextProvider>
  );
};

export const renderSKWidget = ({
  container,
  ...rest
}: ComponentProps<typeof SKApp> & {
  container: Parameters<typeof ReactDOM.createRoot>[0];
}) => {
  if (!rest.apiKey) throw new Error("API key is required");

  const root = ReactDOM.createRoot(container);
  root.render(<SKApp {...rest} />);
};
