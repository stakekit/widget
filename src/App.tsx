import "./polyfills";
import "@stakekit/rainbowkit/styles.css";
import "./styles/theme/global.css";
import "./translation";
import ReactDOM from "react-dom/client";
import { ComponentProps, useEffect } from "react";
import {
  Location,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useSavedRef, useToggleTheme } from "./hooks";
import { container } from "./style.css";
import {
  ReviewPage,
  Layout,
  Details,
  PositionsPage,
  EarnPage,
  StakeStepsPage,
  UnstakeOrPendingActionStepsPage,
  UnstakeOrPendingActionCompletePage,
  StakeCompletePage,
} from "./pages";
import { Box } from "./components";
import { useAutoConnectInjectedProviderMachine } from "./hooks/use-auto-connect-injected-provider-machine";
import { Providers } from "./providers";
import {
  SettingsContextProvider,
  SettingsContextType,
} from "./providers/settings";
import classNames from "clsx";
import { PositionDetails } from "./pages/position-details";
import { useLocationTransition } from "./providers/location-transition";
import { UnstakeOrPendingActionReviewPage } from "./pages/unstake-or-pending-action-review";
import { StakeCheck } from "./pages/cheks/stake-check";
import { UnstakeOrPendingActionCheck } from "./pages/cheks/unstake-or-pending-action-check";
import { ConnectedCheck } from "./pages/cheks/connected-check";
import { UnstakeOrPendingActionContextProvider } from "./state/unstake-or-pending-action";
import { useSKWallet } from "./hooks/wallet/use-sk-wallet";
import { cosmosWalletManager } from "./providers/cosmos/config";

const Widget = () => {
  useToggleTheme();

  const { chain } = useSKWallet();

  const pathnameRef = useSavedRef(useLocation().pathname);
  const navigateRef = useSavedRef(useNavigate());

  /**
   * On chain change, navigate to home page
   */
  useEffect(() => {
    if (pathnameRef.current !== "/") {
      navigateRef.current("/", { replace: true });
    }
  }, [chain, pathnameRef, navigateRef]);

  /**
   * On mount, initialize cosmos wallet manager
   */
  useEffect(() => {
    cosmosWalletManager.onMounted();

    return () => {
      cosmosWalletManager.onUnmounted();
    };
  }, []);

  useAutoConnectInjectedProviderMachine();

  const {
    location,
    displayLocation,
    prevLocationPathName,
    transitionClassName,
    onAnimationEnd,
  } = useLocationTransition();

  return (
    <>
      <Box
        background="background"
        className={classNames([
          container,
          shouldAnimate({ location, prevLocationPathName }) &&
            transitionClassName,
        ])}
        onAnimationEnd={onAnimationEnd}
      >
        <Routes location={displayLocation}>
          <Route element={<Layout />}>
            <Route element={<Details />}>
              <Route index element={<EarnPage />} />
              <Route path="positions" element={<PositionsPage />} />
            </Route>

            <Route element={<ConnectedCheck />}>
              <Route element={<StakeCheck />}>
                <Route path="review" element={<ReviewPage />} />
                <Route path="steps" element={<StakeStepsPage />} />
                <Route path="complete" element={<StakeCompletePage />} />R
              </Route>

              <Route
                element={
                  <UnstakeOrPendingActionContextProvider>
                    <Outlet />
                  </UnstakeOrPendingActionContextProvider>
                }
              >
                <Route
                  path="positions/:integrationId/:defaultOrValidatorId"
                  element={<PositionDetails />}
                />
                <Route
                  path="unstake/:integrationId/:defaultOrValidatorId"
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

                <Route
                  path="pending-action/:integrationId/:defaultOrValidatorId"
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
      </Box>
    </>
  );
};

export const SKApp = (props: SettingsContextType) => {
  return (
    <SettingsContextProvider {...props}>
      <Providers>
        <Widget />
      </Providers>
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

const shouldAnimate = ({
  location,
  prevLocationPathName,
}: {
  location: Location;
  prevLocationPathName: Location["pathname"] | null;
}) => {
  const routesToSkip = ["/", "/positions"];

  const goingToNonSkippedRoute = !routesToSkip.includes(location.pathname);
  const returningFromNonSkippedRoute =
    routesToSkip.includes(location.pathname) &&
    prevLocationPathName &&
    !routesToSkip.includes(prevLocationPathName);

  return goingToNonSkippedRoute || returningFromNonSkippedRoute;
};
