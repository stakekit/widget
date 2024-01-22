import "./polyfills";
import "@stakekit/rainbowkit/styles.css";
import "./styles/theme/global.css";
import "./translation";
import "./services/install-api-manager";
import "./utils/extend-purify";
import ReactDOM from "react-dom/client";
import { ComponentProps, useEffect } from "react";
import {
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  createMemoryRouter,
  useLocation,
  useNavigate,
  Routes,
} from "react-router-dom";
import { useSavedRef, useToggleTheme } from "./hooks";
import {
  Layout,
  ReviewPage,
  StakeStepsPage,
  UnstakeOrPendingActionStepsPage,
  StakeCompletePage,
  UnstakeOrPendingActionCompletePage,
  PositionsPage,
  EarnPage,
  Details,
} from "./pages";
import { useAutoConnectInjectedProviderMachine } from "./hooks/use-auto-connect-injected-provider-machine";
import { Providers } from "./providers";
import {
  SettingsContextProvider,
  SettingsContextType,
} from "./providers/settings";
import { PositionDetails } from "./pages/position-details";
import { StakeCheck } from "./navigation/cheks/stake-check";
import { UnstakeOrPendingActionCheck } from "./navigation/cheks/unstake-or-pending-action-check";
import { ConnectedCheck } from "./navigation/cheks/connected-check";
import { UnstakeOrPendingActionContextProvider } from "./state/unstake-or-pending-action";
import { createPortal } from "react-dom";
import { HelpModal } from "./components/molecules/help-modal";
import { useGeoBlock } from "./hooks/use-geo-block";
import { useRegionCodeName } from "./hooks/use-region-code-names";
import { UnstakeOrPendingActionReviewPage } from "./pages/unstake-or-pending-action-review";
import { useSKWallet } from "./providers/sk-wallet";
import { useHandleDeepLinks } from "./hooks/use-handle-deep-links";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Header } from "./components";
import { headerContainer } from "./pages/components/layout/styles.css";
import { AnimationLayout } from "./navigation/containers/animation-layout";
import { container } from "./style.css";
import { FooterContent } from "./pages/components/footer-outlet";

const Widget = () => {
  useToggleTheme();

  const geoBlock = useGeoBlock();
  const regionCodeName = useRegionCodeName(
    geoBlock ? geoBlock.regionCode : undefined
  );

  const { chain, address } = useSKWallet();

  const pathnameRef = useSavedRef(useLocation().pathname);
  const navigateRef = useSavedRef(useNavigate());

  /**
   * On chain change, navigate to home page
   */
  useEffect(() => {
    if (pathnameRef.current !== "/") {
      const url = new URL(window.location.href);
      const newUrl = new URL(window.location.origin);
      if (url.searchParams.has("embed")) {
        newUrl.searchParams.set("embed", "true");
      }

      window.history.pushState({}, document.title, newUrl.href);
      navigateRef.current("/", { replace: true });
    }
  }, [chain, address, pathnameRef, navigateRef]);

  useHandleDeepLinks();

  useAutoConnectInjectedProviderMachine();

  const location = useLocation();

  /**
   * Dont unmount details page with tabs
   */
  const key =
    location.pathname === "/" || location.pathname === "/positions"
      ? "/"
      : location.pathname;

  return (
    <AnimationLayout>
      <LayoutGroup>
        <motion.div layout="size" className={headerContainer}>
          <Header />
        </motion.div>

        <motion.div layout="size" className={container}>
          <AnimatePresence>
            <Routes location={location} key={key}>
              <Route element={<Layout currentPathname={location.pathname} />}>
                {/* Home + Tabs */}
                <Route element={<Details />}>
                  <Route index element={<EarnPage />} />
                  <Route path="positions" element={<PositionsPage />} />
                </Route>

                <Route element={<ConnectedCheck />}>
                  {/* Stake flow */}
                  <Route element={<StakeCheck />}>
                    <Route path="review" element={<ReviewPage />} />
                    <Route path="steps" element={<StakeStepsPage />} />
                    <Route path="complete" element={<StakeCompletePage />} />
                  </Route>

                  {/* Actions flow */}
                  <Route
                    path="positions/:integrationId/:balanceId"
                    element={
                      <UnstakeOrPendingActionContextProvider>
                        <Outlet />
                      </UnstakeOrPendingActionContextProvider>
                    }
                  >
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
        </motion.div>

        <FooterContent />
      </LayoutGroup>

      <>
        {geoBlock &&
          createPortal(
            <HelpModal
              modal={{
                type: "geoBlock",
                ...geoBlock,
                regionCodeName: regionCodeName.data,
              }}
            />,
            document.body
          )}
      </>
    </AnimationLayout>
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

export const SKApp = (props: SettingsContextType) => {
  return (
    <SettingsContextProvider {...props}>
      <RouterProvider router={router} />
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
