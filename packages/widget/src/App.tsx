import "@stakekit/rainbowkit/styles.css";
import "./shared/styles/theme/global.css";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { type ComponentProps, useState } from "react";
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
  AppContainerProvider,
  NoEnabledYields,
} from "./features/widget-shell/composition";
import { useUnderMaintenance } from "./features/widget-shell/index";
import { UnderMaintenance } from "./features/widget-shell/views";
import type { SKAppProps } from "./public-api/types";
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
      <AppContainerProvider variant={dashboardVariant ? "dashboard" : "widget"}>
        <RouterProvider router={router} />
      </AppContainerProvider>
    </ApplicationRouteContentProvider>
  );
};

const SKAppContent = (props: SKAppProps) => {
  const [isLedgerDappBrowser] = useState(isLedgerDappBrowserProvider);

  return (
    <SKAtomRegistryProvider
      hostConfiguration={props}
      isLedgerLive={isLedgerDappBrowser}
      routes={applicationRoutes}
    >
      <SKAppRouter />
    </SKAtomRegistryProvider>
  );
};

export const SKApp = (props: SKAppProps) => (
  <WidgetInstanceReactBoundary>
    <SKAppContent {...props} />
  </WidgetInstanceReactBoundary>
);

const BundledSKWidget = (props: SKAppProps) => <SKAppContent {...props} />;

export const renderSKWidget = ({
  container,
  ...rest
}: ComponentProps<typeof SKApp> & {
  container: Parameters<typeof ReactDOM.createRoot>[0];
}) => {
  if (!rest.apiKey) throw new Error("API key is required");

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
      rerender: (newProps: SKAppProps) => {
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
