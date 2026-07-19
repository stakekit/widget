import "@stakekit/rainbowkit/styles.css";
import "./translation";
import "./shared/styles/theme/global.css";
import type { ComponentProps } from "react";
import { createRef, useImperativeHandle, useState } from "react";
import ReactDOM from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { Providers } from "./app/composition/providers";
import { SKAtomRegistryProvider } from "./app/composition/providers/atom-runtime";
import { normalizeWidgetConfig } from "./app/config/settings";
import { useWidgetConfig } from "./app/config/use-widget-config";
import { acquireWidgetInstanceClaim } from "./app/embedding/widget-instance-claim";
import { WidgetInstanceReactBoundary } from "./app/embedding/widget-instance-react-boundary";
import { ClassicRoutes } from "./app/routes/classic-routes";
import { DashboardRoutes } from "./app/routes/dashboard-routes";
import { appContainer } from "./features/widget-shell/layout.css";
import type {
  BundledSKWidgetProps,
  SKAppProps,
  VariantProps,
} from "./public-api/types";
import { isLedgerDappBrowserProvider } from "./services/wallet/browser-environment";
import { preloadImages } from "./shared/assets/images";
import { Box } from "./shared/ui/primitives/box";
import { useLoadErrorTranslations } from "./translation";

preloadImages();

const App = () => {
  useLoadErrorTranslations();

  const dashboardVariant = useWidgetConfig("dashboardVariant");

  return dashboardVariant ? <DashboardRoutes /> : <ClassicRoutes />;
};

const Root = () => (
  <Providers>
    <App />
  </Providers>
);

const SKAppContent = (props: SKAppProps) => {
  const variantProps: VariantProps =
    props.variant === "zerion"
      ? { variant: props.variant, chainModal: props.chainModal }
      : { variant: props.variant ?? "default" };

  const [router] = useState(() =>
    createMemoryRouter([{ path: "*", Component: Root }])
  );
  const settings = normalizeWidgetConfig(
    { ...props, ...variantProps },
    { isLedgerLive: isLedgerDappBrowserProvider() }
  );

  return (
    <SKAtomRegistryProvider settings={settings}>
      <Box
        className={appContainer({
          variant: settings.dashboardVariant ? "dashboard" : "widget",
        })}
      >
        <RouterProvider router={router} />
      </Box>
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
