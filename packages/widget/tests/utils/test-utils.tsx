import { RegistryProvider } from "@effect/atom-react";
import type { ComponentProps } from "react";
import { type RenderOptions, render } from "vitest-browser-react";
import { type SKApp, SKAppRegistryContent } from "../../src/App";
import { WidgetConfigBoundaryAdapter } from "../../src/app/composition/providers/widget-config-binding";
import { WidgetInstanceReactBoundary } from "../../src/app/embedding/widget-instance-react-boundary";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { applicationRuntimeInitAtom } from "../../src/app/runtime/application-runtime-init";
import { walletConnectorSourceRuntime } from "../../src/app/runtime/wallet-connector-source-runtime";
import {
  WalletConnectorSource,
  type WalletListFactory,
} from "../../src/services/wallet/wallet-connector-source";

const renderApp = (opts?: {
  options?: RenderOptions;
  skProps?: ComponentProps<typeof SKApp>;
  walletListFactory?: WalletListFactory;
}) => {
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
  const App = (
    <WidgetInstanceReactBoundary>
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
    </WidgetInstanceReactBoundary>
  );

  return render(App, opts?.options);
};

export * from "vitest-browser-react";
export { renderApp };
