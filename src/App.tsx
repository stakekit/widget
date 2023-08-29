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
  UnstakeOrClaimStepsPage,
  UnstakeOrClaimCompletePage,
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
import { UnstakeOrClaimReviewPage } from "./pages/unstake-or-claim-review";
import { StakeCheck } from "./pages/cheks/stake-check";
import { UnstakeOrClaimCheck } from "./pages/cheks/unstake-or-claim-check";
import { ConnectedCheck } from "./pages/cheks/connected-check";
import { UnstakeOrClaimContextProvider } from "./state/unstake-or-claim";
import { useSKWallet } from "./hooks/wallet/use-sk-wallet";

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

  useAutoConnectInjectedProviderMachine();

  const {
    location,
    displayLocation,
    prevLocationPathName,
    transitionClassName,
    onAnimationEnd,
  } = useLocationTransition();

  return (
    <Box
      background="background"
      className={classNames([
        container,
        shouldAnimate({ displayLocation, location, prevLocationPathName }) &&
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
                <UnstakeOrClaimContextProvider>
                  <Outlet />
                </UnstakeOrClaimContextProvider>
              }
            >
              <Route
                path="positions/:integrationId/:defaultOrValidatorId"
                element={<PositionDetails />}
              />
              <Route
                path="unstake/:integrationId/:defaultOrValidatorId"
                element={<UnstakeOrClaimCheck />}
              >
                <Route path="review" element={<UnstakeOrClaimReviewPage />} />
                <Route path="steps" element={<UnstakeOrClaimStepsPage />} />
                <Route
                  path="complete"
                  element={<UnstakeOrClaimCompletePage />}
                />
              </Route>

              <Route
                path="claim/:integrationId/:defaultOrValidatorId"
                element={<UnstakeOrClaimCheck />}
              >
                <Route path="review" element={<UnstakeOrClaimReviewPage />} />
                <Route path="steps" element={<UnstakeOrClaimStepsPage />} />
                <Route
                  path="complete"
                  element={<UnstakeOrClaimCompletePage />}
                />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Box>
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
  displayLocation,
  location,
  prevLocationPathName,
}: {
  displayLocation: Location;
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
