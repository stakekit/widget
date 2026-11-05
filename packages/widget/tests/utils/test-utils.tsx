import { RegistryProvider } from "@effect/atom-react";
import type { ComponentProps } from "react";
import {
  type RenderOptions,
  type RenderResult,
  render,
} from "vitest-browser-react";
import { type SKApp, SKAppRegistryContent } from "../../src/App";
import { WidgetConfigBoundaryAdapter } from "../../src/app/composition/providers/widget-config-binding";
import { WidgetErrorBoundary } from "../../src/app/composition/widget-error-boundary";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { applicationRuntimeInitAtom } from "../../src/app/runtime/application-runtime-init";
import { walletConnectorSourceRuntime } from "../../src/app/runtime/wallet-connector-source-runtime";
import {
  WalletConnectorSource,
  type WalletListFactory,
} from "../../src/services/wallet/wallet-connector-source";

type AppOptions = {
  skProps?: ComponentProps<typeof SKApp>;
  walletListFactory?: WalletListFactory;
};

const appElement = (opts?: AppOptions) => {
  const configuration: ComponentProps<typeof SKApp> = {
    apiKey: import.meta.env.VITE_API_KEY,
    ...opts?.skProps,
  };
  const { children, ...hostConfiguration } = configuration;
  const connectorSourceInitialValues = opts?.walletListFactory
    ? ([
        [
          walletConnectorSourceRuntime.layer,
          WalletConnectorSource.layer(opts.walletListFactory),
        ],
      ] as const)
    : [];

  return (
    <WidgetErrorBoundary hostConfiguration={hostConfiguration}>
      <RegistryProvider
        initialValues={[
          [
            applicationRuntimeInitAtom,
            {
              hostConfiguration,
              isLedgerLive: false,
              routes: applicationRoutes,
            },
          ],
          ...connectorSourceInitialValues,
        ]}
      >
        <WidgetConfigBoundaryAdapter hostConfiguration={hostConfiguration}>
          <SKAppRegistryContent>{children}</SKAppRegistryContent>
        </WidgetConfigBoundaryAdapter>
      </RegistryProvider>
    </WidgetErrorBoundary>
  );
};

const renderApp = (opts?: AppOptions & { options?: RenderOptions }) =>
  render(appElement(opts), opts?.options);

/**
 * Passes new Host Configuration to a Widget mounted by `renderApp`, as a host
 * re-rendering `SKApp` with new props does. The Widget stays mounted.
 */
const rerenderApp = (app: RenderResult, opts?: AppOptions) =>
  app.rerender(appElement(opts));

export * from "vitest-browser-react";
export { renderApp, rerenderApp };
