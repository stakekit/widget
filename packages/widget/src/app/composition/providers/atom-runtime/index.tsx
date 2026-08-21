import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import type { RouteObject } from "react-router";
import type { SKHostConfiguration } from "../../../../public-api/types";
import { applicationRuntimeInitAtom } from "../../../runtime/application-runtime-init";
import { WidgetConfigBoundaryAdapter } from "../widget-config-binding";

type SKAtomRegistryProviderProps = PropsWithChildren<{
  readonly hostConfiguration: SKHostConfiguration;
  readonly isLedgerLive?: boolean;
  readonly routes: ReadonlyArray<RouteObject>;
}>;

export const SKAtomRegistryProvider = ({
  children,
  hostConfiguration,
  isLedgerLive = false,
  routes,
}: SKAtomRegistryProviderProps) => {
  return (
    <RegistryProvider
      initialValues={[
        [
          applicationRuntimeInitAtom,
          { hostConfiguration, isLedgerLive, routes },
        ],
      ]}
    >
      <WidgetConfigBoundaryAdapter hostConfiguration={hostConfiguration}>
        {children}
      </WidgetConfigBoundaryAdapter>
    </RegistryProvider>
  );
};
