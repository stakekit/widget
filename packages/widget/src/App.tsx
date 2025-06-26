import "@stakekit/rainbowkit/styles.css";
import "./translation";
import "./utils/extend-purify";
import "./styles/theme/global.css";
import { Dashboard } from "@sk-widget/Dashboard";
import { Widget } from "@sk-widget/Widget";
import { Box } from "@sk-widget/components/atoms/box";
import { useToggleTheme } from "@sk-widget/hooks/use-toggle-theme";
import type {
  SettingsProps,
  VariantProps,
} from "@sk-widget/providers/settings/types";
import type { ComponentProps, RefObject } from "react";
import { createRef, useImperativeHandle, useState } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createMemoryRouter } from "react-router";
import { preloadImages } from "./assets/images";
import { useIsomorphicEffect } from "./hooks/use-isomorphic-effect";
import { Providers } from "./providers";
import { SettingsContextProvider, useSettings } from "./providers/settings";
import { appContainer } from "./style.css";
import { useLoadErrorTranslations } from "./translation";

preloadImages();

const App = () => {
  useToggleTheme();
  useLoadErrorTranslations();

  const { dashboardVariant } = useSettings();

  return dashboardVariant ? <Dashboard /> : <Widget />;
};

const Root = () => {
  const [showChild, setShowChild] = useState(false);

  useIsomorphicEffect(() => setShowChild(true), []); // ssr disabled

  return <Providers>{showChild && <App />}</Providers>;
};

export type SKAppProps = SettingsProps & (VariantProps | { variant?: never });

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

export type BundledSKWidgetProps = SKAppProps & {
  ref?: RefObject<{ rerender: (newProps: BundledSKWidgetProps) => void }>;
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
