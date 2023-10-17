import "./polyfills";
import "@stakekit/rainbowkit/styles.css";
import "./styles/theme/global.css";
import "./translation";
import "./services/install-api-manager";
import "./utils/extend-purify";
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
import { StakeCheck } from "./pages/cheks/stake-check";
import { UnstakeOrPendingActionCheck } from "./pages/cheks/unstake-or-pending-action-check";
import { ConnectedCheck } from "./pages/cheks/connected-check";
import { UnstakeOrPendingActionContextProvider } from "./state/unstake-or-pending-action";
import { createPortal } from "react-dom";
import { HelpModal } from "./components/molecules/help-modal";
import { useGeoBlock } from "./hooks/use-geo-block";
import { useRegionCodeName } from "./hooks/use-region-code-names";
import { UnstakeOrPendingActionReviewPage } from "./pages/unstake-or-pending-action-review";
import { useCosmosConfig } from "./providers/cosmos/config";
import { useSKWallet } from "./providers/sk-wallet";

const Widget = () => {
  useToggleTheme();

  const geoBlock = useGeoBlock();
  const regionCodeName = useRegionCodeName(
    geoBlock ? geoBlock.regionCode : undefined
  );

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

  const cosmosConfig = useCosmosConfig();

  /**
   * On mount, initialize cosmos wallet manager
   */
  useEffect(() => {
    cosmosConfig.data?.cosmosWalletManager.onMounted();

    return () => {
      cosmosConfig.data?.cosmosWalletManager.onUnmounted();
    };
  }, [cosmosConfig.data?.cosmosWalletManager]);

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
                <Route path="complete" element={<StakeCompletePage />} />
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
