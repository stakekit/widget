import "@stakekit/rainbowkit/styles.css";
import "./translation";
import "./styles/theme/global.css";
import type { ComponentProps } from "react";
import { createRef, useImperativeHandle, useState } from "react";
import ReactDOM from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { preloadImages } from "./assets/images";
import { Box } from "./components/atoms/box";
import { Dashboard } from "./Dashboard";
import { Providers } from "./providers";
import { SettingsContextProvider, useSettings } from "./providers/settings";
import type {
  BundledSKWidgetProps,
  SKAppProps,
  VariantProps,
} from "./public-api/types";
import { appContainer } from "./style.css";
import { useLoadErrorTranslations } from "./translation";
import { Widget } from "./Widget";

preloadImages();

const App = () => {
  useLoadErrorTranslations();

  const { dashboardVariant } = useSettings();

  return dashboardVariant ? <Dashboard /> : <Widget />;
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

  return (
    <SettingsContextProvider {...variantProps} {...props}>
      <Box
        className={appContainer({
          variant: props.dashboardVariant ? "dashboard" : "widget",
        })}
      >
        <RouterProvider router={router} />
      </Box>
    </SettingsContextProvider>
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
