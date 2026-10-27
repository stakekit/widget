import "./shared/styles/theme/global.css";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { type PropsWithChildren, useState } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { ApplicationRouteContentProvider } from "./app/composition/application-route-content";
import { Providers } from "./app/composition/providers";
import { SKAtomRegistryProvider } from "./app/composition/providers/atom-runtime";
import { WidgetConfigurationUnavailable } from "./app/composition/widget-configuration-unavailable";
import { applicationRoutes } from "./app/routes/application-routes";
import { useApplicationRouteEffects } from "./app/routes/react/use-application-route-effects";
import { ClassicRoutes } from "./app/routes/ui/classic-routes";
import { DashboardRoutes } from "./app/routes/ui/dashboard-routes";
import { applicationRouterAtom } from "./app/runtime/application-router";
import {
  walletEnabledNetworksResultAtom,
  walletExternalProviderChainsEnabledResultAtom,
} from "./features/wallet/index";
import {
  rejectedWidgetConfigAtom,
  useWidgetConfig,
} from "./features/widget-configuration/index";
import {
  AppContainer,
  NetworkNotSupported,
  NoEnabledYields,
} from "./features/widget-shell/composition";
import { useUnderMaintenance } from "./features/widget-shell/index";
import { UnderMaintenance } from "./features/widget-shell/views";
import type { SKAppProps } from "./public-api/react-types";
import type { BundledSKWidgetProps } from "./public-api/types";
import { isLedgerDappBrowserProvider } from "./services/wallet/browser-environment";
import { preloadImages } from "./shared/assets/images";

preloadImages();

const App = () => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const enabledNetworks = useAtomValue(walletEnabledNetworksResultAtom);
  const externalProviderChainsEnabled = useAtomValue(
    walletExternalProviderChainsEnabledResultAtom
  );
  const underMaintenance = useUnderMaintenance();
  const noEnabledYields =
    AsyncResult.isSuccess(enabledNetworks) && enabledNetworks.value.size === 0;
  const networkNotSupported =
    AsyncResult.isSuccess(externalProviderChainsEnabled) &&
    !externalProviderChainsEnabled.value;

  useApplicationRouteEffects();

  if (noEnabledYields && !underMaintenance) return <NoEnabledYields />;
  if (networkNotSupported && !underMaintenance) return <NetworkNotSupported />;

  const routeContent = (() => {
    if (underMaintenance) return <UnderMaintenance />;
    return dashboardVariant ? <DashboardRoutes /> : <ClassicRoutes />;
  })();

  return routeContent;
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

export const SKAppRegistryContent = ({ children }: PropsWithChildren) => {
  const rejectedConfig = useAtomValue(rejectedWidgetConfigAtom);

  return (
    <>
      {rejectedConfig ? (
        <WidgetConfigurationUnavailable presentation={rejectedConfig} />
      ) : (
        <SKAppRouter />
      )}
      {children}
    </>
  );
};

const SKAppProductionContent = ({
  children,
  ...hostConfiguration
}: SKAppProps) => {
  const [isLedgerDappBrowser] = useState(isLedgerDappBrowserProvider);

  return (
    <SKAtomRegistryProvider
      hostConfiguration={hostConfiguration}
      isLedgerLive={isLedgerDappBrowser}
      routes={applicationRoutes}
    >
      <SKAppRegistryContent>{children}</SKAppRegistryContent>
    </SKAtomRegistryProvider>
  );
};

export const SKApp = ({ children, ...hostConfiguration }: SKAppProps) => (
  <SKAppProductionContent {...hostConfiguration}>
    {children}
  </SKAppProductionContent>
);

export interface RenderedSKWidget {
  rerender: (newProps: BundledSKWidgetProps) => void;
  unmount: () => void;
}

export const renderSKWidget = ({
  container,
  ...rest
}: BundledSKWidgetProps & {
  readonly container: Parameters<typeof ReactDOM.createRoot>[0];
}): RenderedSKWidget => {
  const root = ReactDOM.createRoot(container);
  let currentProps = rest;
  let unmounted = false;
  const render = () =>
    root.render(<SKAppProductionContent {...currentProps} />);

  render();

  return {
    rerender: (newProps: BundledSKWidgetProps) => {
      if (unmounted) return;
      currentProps = newProps;
      render();
    },
    unmount: () => {
      if (unmounted) return;

      unmounted = true;
      root.unmount();
    },
  };
};
