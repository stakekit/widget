import "@stakekit/rainbowkit/styles.css";
import "./styles/theme/global.css";
import "./translation";
import "./utils/extend-purify";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import type { ComponentProps } from "react";
import { useState } from "react";
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
import { StakeCheck } from "./navigation/cheks/stake-check";
import { UnstakeOrPendingActionCheck } from "./navigation/cheks/unstake-or-pending-action-check";
import { AnimationLayout } from "./navigation/containers/animation-layout";
import {
  Details,
  EarnPage,
  Layout,
  PositionsPage,
  StakeCompletePage,
  StakeStepsPage,
  UnstakeOrPendingActionCompletePage,
  UnstakeOrPendingActionStepsPage,
} from "./pages";
import { FooterContent } from "./pages/components/footer-outlet";
import { headerContainer } from "./pages/components/layout/styles.css";
import { PoweredBy } from "./pages/components/powered-by";
import { PositionDetailsPage } from "./pages/position-details";
import {
  StakeReviewPage,
  UnstakeOrPendingActionReviewPage,
} from "./pages/review";
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
            <AnimatePresence>
              <Routes location={current} key={key}>
                <Route element={<Layout currentPathname={current.pathname} />}>
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

export type SKAppProps = SettingsProps & (VariantProps | { variant?: never });

export const SKApp = (props: SKAppProps) => {
  const [showChild, setShowChild] = useState(false);

  useIsomorphicEffect(() => setShowChild(true), []); // ssr disabled

  const variantProps: VariantProps =
    !props.variant || props.variant === "default"
      ? { variant: "default" }
      : { variant: props.variant, chainModal: props.chainModal };

  return (
    <SettingsContextProvider {...variantProps} {...props}>
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
