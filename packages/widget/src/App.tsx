import "@stakekit/rainbowkit/styles.css";
import "./translation";
import "./shared/styles/theme/global.css";
import { useAtomValue } from "@effect/atom-react";
import type { ComponentProps } from "react";
import { createRef, useImperativeHandle, useState } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { ApplicationRouteContentProvider } from "./app/composition/application-route-content";
import { Providers } from "./app/composition/providers";
import { SKAtomRegistryProvider } from "./app/composition/providers/atom-runtime";
import { normalizeWidgetConfig } from "./app/config/settings";
import { useWidgetConfig } from "./app/config/use-widget-config";
import { acquireWidgetInstanceClaim } from "./app/embedding/widget-instance-claim";
import { WidgetInstanceReactBoundary } from "./app/embedding/widget-instance-react-boundary";
import { applicationRoutes } from "./app/routes/application-routes";
import { ClassicRoutes } from "./app/routes/classic-routes";
import { DashboardRoutes } from "./app/routes/dashboard-routes";
import { useHandleDeepLinks } from "./app/routes/hooks/use-handle-deep-links";
import { applicationRouterAtom } from "./app/runtime/application-router-runtime";
import { useLoadErrorTranslations } from "./app/translation/use-load-error-translations";
import { appContainer } from "./features/widget-shell/components";
import type {
  BundledSKWidgetProps,
  SKAppProps,
  VariantProps,
} from "./public-api/types";
import { isLedgerDappBrowserProvider } from "./services/wallet/browser-environment";
import { preloadImages } from "./shared/assets/images";
import { Box } from "./shared/ui/primitives/box";

preloadImages();

const App = () => {
  useLoadErrorTranslations();
  useHandleDeepLinks();

  const dashboardVariant = useWidgetConfig("dashboardVariant");

  return dashboardVariant ? <DashboardRoutes /> : <ClassicRoutes />;
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
  const variantProps: VariantProps =
    props.variant === "zerion"
      ? { variant: props.variant, chainModal: props.chainModal }
      : { variant: props.variant ?? "default" };

  const settings = normalizeWidgetConfig(
    { ...props, ...variantProps },
    { isLedgerLive: isLedgerDappBrowserProvider() }
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

const BundledSKWidget = (_props: BundledSKWidgetProps) => {
  const [props, setProps] = useState(_props);

  useImperativeHandle(props.ref, () => ({
    rerender: (newProps: BundledSKWidgetProps) => setProps(newProps),
  }));

  return <SKAppContent {...props} />;
};

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

    const appRef = createRef<{ rerender: () => void }>() as NonNullable<
      BundledSKWidgetProps["ref"]
    >;

    root.render(<BundledSKWidget {...rest} ref={appRef} />);

    let unmounted = false;

    return {
      rerender: (newProps: SKAppProps) =>
        appRef.current.rerender({ ...newProps, ref: appRef }),
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
