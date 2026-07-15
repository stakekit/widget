import "@stakekit/rainbowkit/styles.css";
import "./translation";
import "./shared/styles/theme/global.css";
import type { ComponentProps } from "react";
import { createRef, useImperativeHandle, useState } from "react";
import ReactDOM from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { Providers } from "./app/composition/providers";
import { SKAtomRegistryProvider } from "./app/composition/providers/effect-atom-runtime";
import { normalizeWidgetConfig, useWidgetConfig } from "./app/config";
import { ClassicRoutes, DashboardRoutes } from "./app/routes";
import { appContainer } from "./features/widget-shell";
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

export type { BundledSKWidgetProps, SKAppProps } from "./public-api/types";

export const SKApp = (props: SKAppProps) => {
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

const BundledSKWidget = (_props: BundledSKWidgetProps) => {
  const [props, setProps] = useState(_props);

  useImperativeHandle(props.ref, () => ({
    rerender: (newProps: BundledSKWidgetProps) => setProps(newProps),
  }));

  return <SKApp {...props} />;
};

export const renderSKWidget = ({
  container,
  ...rest
}: ComponentProps<typeof SKApp> & {
  container: Parameters<typeof ReactDOM.createRoot>[0];
}) => {
  if (!rest.apiKey) throw new Error("API key is required");

  const root = ReactDOM.createRoot(container);

  const appRef = createRef<{ rerender: () => void }>() as NonNullable<
    BundledSKWidgetProps["ref"]
  >;

  root.render(<BundledSKWidget {...rest} ref={appRef} />);

  return {
    rerender: (newProps: SKAppProps) =>
      appRef.current.rerender({ ...newProps, ref: appRef }),
  };
};
