import "@stakekit/rainbowkit/styles.css";
import "./shared/styles/theme/global.css";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useState } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { ApplicationRouteContentProvider } from "./app/composition/application-route-content";
import { Providers } from "./app/composition/providers";
import { SKAtomRegistryProvider } from "./app/composition/providers/atom-runtime";
import { acquireWidgetInstanceClaim } from "./app/embedding/widget-instance-claim";
import { WidgetInstanceReactBoundary } from "./app/embedding/widget-instance-react-boundary";
import { ApplicationRouteEffects } from "./app/routes/application-route-effects";
import { applicationRoutes } from "./app/routes/application-routes";
import { ClassicRoutes } from "./app/routes/classic-routes";
import { DashboardRoutes } from "./app/routes/dashboard-routes";
import { applicationRouterAtom } from "./app/runtime/application-router-runtime";
import { walletEnabledNetworksResultAtom } from "./features/wallet/index";
import { useWidgetConfig } from "./features/widget-configuration/index";
import {
  AppContainer,
  NoEnabledYields,
} from "./features/widget-shell/composition";
import { useUnderMaintenance } from "./features/widget-shell/index";
import { UnderMaintenance } from "./features/widget-shell/views";
import type { SKAppProps, SKHostConfiguration } from "./public-api/types";
import { isLedgerDappBrowserProvider } from "./services/wallet/browser-environment";
import { preloadImages } from "./shared/assets/images";

preloadImages();

const App = () => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const enabledNetworks = useAtomValue(walletEnabledNetworksResultAtom);
  const underMaintenance = useUnderMaintenance();
  const noEnabledYields =
    AsyncResult.isSuccess(enabledNetworks) && enabledNetworks.value.size === 0;

  if (noEnabledYields && !underMaintenance) return <NoEnabledYields />;

  const routeContent = (() => {
    if (underMaintenance) return <UnderMaintenance />;
    return dashboardVariant ? <DashboardRoutes /> : <ClassicRoutes />;
  })();

  return (
    <>
      <ApplicationRouteEffects />
      {routeContent}
    </>
  );
};

const Root = () => (
  <Providers>
    <App />
  </Providers>
);

const SKAppRouter = () => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const router = useAtomValue(applicationRouterAtom);

  return (
    <ApplicationRouteContentProvider value={<Root />}>
      <AppContainer variant={dashboardVariant ? "dashboard" : "widget"}>
        <RouterProvider router={router} />
      </AppContainer>
    </ApplicationRouteContentProvider>
  );
};

const SKAppContent = ({ children, ...hostConfiguration }: SKAppProps) => {
  const [isLedgerDappBrowser] = useState(isLedgerDappBrowserProvider);

  return (
    <SKAtomRegistryProvider
      hostConfiguration={hostConfiguration}
      isLedgerLive={isLedgerDappBrowser}
      routes={applicationRoutes}
    >
      <SKAppRouter />
      {children}
    </SKAtomRegistryProvider>
  );
};

export const SKApp = ({ children, ...hostConfiguration }: SKAppProps) => (
  <WidgetInstanceReactBoundary>
    <SKAppContent {...hostConfiguration}>{children}</SKAppContent>
  </WidgetInstanceReactBoundary>
);

const BundledSKWidget = (props: SKHostConfiguration) => (
  <SKAppContent {...props} />
);

export const renderSKWidget = ({
  container,
  ...rest
}: SKHostConfiguration & {
  container: Parameters<typeof ReactDOM.createRoot>[0];
}) => {
  const releaseClaim = acquireWidgetInstanceClaim(
    container.ownerDocument ?? document
  );
  let root: ReturnType<typeof ReactDOM.createRoot>;

  try {
    root = ReactDOM.createRoot(container);
    let currentProps = rest;
    let unmounted = false;
    const render = () => root.render(<BundledSKWidget {...currentProps} />);

    render();

    return {
      rerender: (newProps: SKHostConfiguration) => {
        if (unmounted) return;
        currentProps = newProps;
        render();
      },
      unmount: () => {
        if (unmounted) return;

        unmounted = true;
        try {
          root.unmount();
        } finally {
          releaseClaim();
        }
      },
    };
  } catch (error) {
    releaseClaim();
    throw error;
  }
};
