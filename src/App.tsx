import "@stakekit/rainbowkit/styles.css";
import "./styles/theme/global.css";
import "./translation";
import "./utils/extend-purify";
import ReactDOM from "react-dom/client";
import type { ComponentProps } from "react";
import { useState } from "react";
import {
  Navigate,
  Route,
  RouterProvider,
  createMemoryRouter,
  useNavigate,
  Routes,
} from "react-router-dom";
import { useSavedRef, useToggleTheme } from "./hooks";
import {
  Layout,
  StakeStepsPage,
  UnstakeOrPendingActionStepsPage,
  StakeCompletePage,
  UnstakeOrPendingActionCompletePage,
  PositionsPage,
  EarnPage,
  Details,
} from "./pages";
import { Providers } from "./providers";
import type { SettingsContextType } from "./providers/settings";
import { SettingsContextProvider } from "./providers/settings";
import { PositionDetails } from "./pages/position-details";
import { StakeCheck } from "./navigation/cheks/stake-check";
import { UnstakeOrPendingActionCheck } from "./navigation/cheks/unstake-or-pending-action-check";
import { ConnectedCheck } from "./navigation/cheks/connected-check";
import { UnstakeOrPendingActionProvider } from "./state/unstake-or-pending-action/";
import { useSKWallet } from "./providers/sk-wallet";
import { useHandleDeepLinks } from "./hooks/use-handle-deep-links";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Box, Header } from "./components";
import { headerContainer } from "./pages/components/layout/styles.css";
import { AnimationLayout } from "./navigation/containers/animation-layout";
import { appContainer, container } from "./style.css";
import { FooterContent } from "./pages/components/footer-outlet";
import { useDetailsMatch } from "./hooks/navigation/use-details-match";
import { useSKLocation } from "./providers/location";
import { MaybeWindow } from "./utils/maybe-window";
import { GlobalModals } from "./components/molecules/global-modals";
import { usePrevious } from "./hooks/use-previous";
import {
  StakeReviewPage,
  UnstakeOrPendingActionReviewPage,
} from "./pages/review";
import { useIsomorphicEffect } from "./hooks/use-isomorphic-effect";
import { useLoadErrorTranslations } from "./translation";
import { PoweredBy } from "./pages/components/powered-by";
import { useUpdateEffect } from "./hooks/use-update-effect";
import { preloadImages } from "./assets/images";

preloadImages();

const Widget = () => {
  useToggleTheme();

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

  useHandleDeepLinks();

  const detailsMatch = useDetailsMatch();

  /**
   * Dont unmount details page with tabs
   * Handle position details pages in their own Routes
   */
  const key = detailsMatch ? "/" : current.pathname;

  return (
    <>
      <AnimationLayout>
        <LayoutGroup>
          <motion.div layout="position" className={headerContainer}>
            <Header />
          </motion.div>

          <motion.div layout="position" className={container}>
            <UnstakeOrPendingActionProvider>
              <AnimatePresence>
                <Routes location={current} key={key}>
                  <Route
                    element={<Layout currentPathname={current.pathname} />}
                  >
                    {/* Home + Tabs */}
                    <Route element={<Details />}>
                      <Route index element={<EarnPage />} />
                      <Route path="positions" element={<PositionsPage />} />
                    </Route>

                    <Route element={<ConnectedCheck />}>
                      {/* Stake flow */}
                      <Route element={<StakeCheck />}>
                        <Route path="review" element={<StakeReviewPage />} />
                        <Route path="steps" element={<StakeStepsPage />} />
                        <Route
                          path="complete"
                          element={<StakeCompletePage />}
                        />
                      </Route>

                      {/* Unstake or pending actions flow */}
                      <Route path="positions/:integrationId/:balanceId">
                        <Route index element={<PositionDetails />} />
                        <Route
                          path="select-validator/:pendingActionType"
                          element={<PositionDetails />}
                        />

                        {/* Unstaking */}
                        <Route
                          path="unstake"
                          element={<UnstakeOrPendingActionCheck />}
                        >
                          <Route
                            path="review"
                            element={<UnstakeOrPendingActionReviewPage />}
                          />
                          <Route
                            path="steps"
                            element={<UnstakeOrPendingActionStepsPage />}
                          />
                          <Route
                            path="complete"
                            element={<UnstakeOrPendingActionCompletePage />}
                          />
                        </Route>

                        {/* Pending Actions */}
                        <Route
                          path="pending-action"
                          element={<UnstakeOrPendingActionCheck />}
                        >
                          <Route
                            path="review"
                            element={<UnstakeOrPendingActionReviewPage />}
                          />
                          <Route
                            path="steps"
                            element={<UnstakeOrPendingActionStepsPage />}
                          />
                          <Route
                            path="complete"
                            element={<UnstakeOrPendingActionCompletePage />}
                          />
                        </Route>
                      </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </AnimatePresence>
            </UnstakeOrPendingActionProvider>
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
  return (
    <Providers>
      <Widget />
    </Providers>
  );
};

const router = createMemoryRouter([{ path: "*", Component: Root }]);

export type SKAppProps = Omit<SettingsContextType, "variant"> &
  Partial<Pick<SettingsContextType, "variant">>;

export const SKApp = (props: SKAppProps) => {
  const [showChild, setShowChild] = useState(false);
  const [key, reloadApp] = useState(() => Date.now());

  useIsomorphicEffect(() => setShowChild(true), []); // ssr disabled

  useUpdateEffect(() => {
    reloadApp(Date.now());
  }, [
    props.externalProviders?.currentAddress,
    props.externalProviders?.currentChain,
  ]);

  return (
    <SettingsContextProvider
      key={key}
      variant={props.variant ?? "default"}
      {...props}
    >
      <Box className={appContainer}>
        {showChild && <RouterProvider router={router} />}
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
