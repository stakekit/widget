import "@stakekit/rainbowkit/styles.css";
import "./shared/styles/theme/global.css";
import { useAtomValue } from "@effect/atom-react";
import { type ComponentProps, useState } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { ApplicationRouteContentProvider } from "./app/composition/application-route-content";
import { Providers } from "./app/composition/providers";
import { SKAtomRegistryProvider } from "./app/composition/providers/atom-runtime";
import { normalizeWidgetConfig } from "./app/config/settings";
import { useWidgetConfig } from "./app/config/use-widget-config";
import { acquireWidgetInstanceClaim } from "./app/embedding/widget-instance-claim";
import { WidgetInstanceReactBoundary } from "./app/embedding/widget-instance-react-boundary";
import { ApplicationRouteEffects } from "./app/routes/application-route-effects";
import { applicationRoutes } from "./app/routes/application-routes";
import { ClassicRoutes } from "./app/routes/classic-routes";
import { DashboardRoutes } from "./app/routes/dashboard-routes";
import { applicationRouterAtom } from "./app/runtime/application-router-runtime";
import { appContainer } from "./features/widget-shell/components";
import type { SKAppProps, VariantProps } from "./public-api/types";
import { isLedgerDappBrowserProvider } from "./services/wallet/browser-environment";
import { preloadImages } from "./shared/assets/images";
import { Box } from "./shared/ui/primitives/box";

preloadImages();

const App = () => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");

  return (
    <>
      <ApplicationRouteEffects />
      {dashboardVariant ? <DashboardRoutes /> : <ClassicRoutes />}
    </>
  );
};

const Root = () => (
  <Providers>
    <App />
  </Providers>
);

const SKAppRouter = ({
  dashboardVariant,
}: {
  readonly dashboardVariant: boolean;
}) => {
  const router = useAtomValue(applicationRouterAtom);

  return (
    <ApplicationRouteContentProvider value={<Root />}>
      <Box
        className={appContainer({
          variant: dashboardVariant ? "dashboard" : "widget",
        })}
      >
        <RouterProvider router={router} />
      </Box>
    </ApplicationRouteContentProvider>
  );
};

const SKAppContent = (props: SKAppProps) => {
  const [isLedgerDappBrowser] = useState(isLedgerDappBrowserProvider);
  const variantProps: VariantProps =
    props.variant === "zerion"
      ? { variant: props.variant, chainModal: props.chainModal }
      : { variant: props.variant ?? "default" };

  const settings = normalizeWidgetConfig(
    { ...props, ...variantProps },
    { isLedgerLive: isLedgerDappBrowser }
  );

  return (
    <SKAtomRegistryProvider routes={applicationRoutes} settings={settings}>
      <SKAppRouter dashboardVariant={!!settings.dashboardVariant} />
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
