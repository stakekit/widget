import "@stakekit/rainbowkit/styles.css";
import "./translation";
import "./utils/extend-purify";
import "./styles/theme/global.css";
import type { ComponentProps, RefObject } from "react";
import {
  createRef,
  useEffect,
  useImperativeHandle,
  useReducer,
  useState,
} from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import {
  createMemoryRouter,
  RouterProvider,
  useRouteError,
} from "react-router";
import { preloadImages } from "./assets/images";
import { Box } from "./components/atoms/box";
import { Dashboard } from "./Dashboard";
import { Providers } from "./providers";
import {
  captureWidgetException,
  ErrorTrackingProvider,
  WidgetErrorDialog,
} from "./providers/error-tracking";
import { SettingsContextProvider, useSettings } from "./providers/settings";
import type { SettingsProps, VariantProps } from "./providers/settings/types";
import { ThemeWrapper } from "./providers/theme-wrapper";
import { appContainer } from "./style.css";
import { i18nInstance, useLoadErrorTranslations } from "./translation";
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

const RouteErrorBoundary = ({ onRetry }: { onRetry: () => void }) => {
  const error = useRouteError();

  useEffect(() => {
    captureWidgetException(error, {
      mechanism: "react-router-error-boundary",
    });
  }, [error]);

  return <WidgetErrorDialog onRetry={onRetry} />;
};

export type SKAppProps = SettingsProps & (VariantProps | { variant?: never });

export const SKApp = (props: SKAppProps) => {
  const variantProps: VariantProps =
    props.variant === "zerion"
      ? { variant: props.variant, chainModal: props.chainModal }
      : { variant: props.variant ?? "default" };

  const [routerVersion, resetRouter] = useReducer((state) => state + 1, 0);
  const [router] = useState(() =>
    createMemoryRouter([
      {
        path: "*",
        Component: Root,
        errorElement: (
          <RouteErrorBoundary key={routerVersion} onRetry={resetRouter} />
        ),
      },
    ])
  );

  return (
    <SettingsContextProvider {...variantProps} {...props}>
      <I18nextProvider i18n={i18nInstance}>
        <ThemeWrapper>
          <Box
            className={appContainer({
              variant: props.dashboardVariant ? "dashboard" : "widget",
            })}
          >
            <ErrorTrackingProvider>
              <RouterProvider router={router} key={routerVersion} />
            </ErrorTrackingProvider>
          </Box>
        </ThemeWrapper>
      </I18nextProvider>
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

  const root = ReactDOM.createRoot(container, {
    onCaughtError: (error, errorInfo) => {
      captureWidgetException(error, {
        mechanism: "react-root-caught-error",
        componentStack: errorInfo.componentStack ?? undefined,
      });
    },
    onRecoverableError: (error, errorInfo) => {
      captureWidgetException(error, {
        mechanism: "react-root-recoverable-error",
        componentStack: errorInfo.componentStack ?? undefined,
      });
    },
    onUncaughtError: (error, errorInfo) => {
      captureWidgetException(error, {
        mechanism: "react-root-uncaught-error",
        componentStack: errorInfo.componentStack ?? undefined,
        handled: false,
      });
    },
  });

  const appRef = createRef<{ rerender: () => void }>() as NonNullable<
    BundledSKWidgetProps["ref"]
  >;

  root.render(<BundledSKWidget {...rest} ref={appRef} />);

  return {
    rerender: (newProps: SKAppProps) =>
      appRef.current.rerender({ ...newProps, ref: appRef }),
  };
};
