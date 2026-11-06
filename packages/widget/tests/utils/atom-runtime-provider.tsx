import { RegistryProvider } from "@effect/atom-react";
import type { ComponentProps, PropsWithChildren } from "react";

import { WidgetConfigBoundaryAdapter } from "../../src/app/composition/providers/widget-config-binding";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { applicationRuntimeInitAtom } from "../../src/app/runtime/application-runtime-init";
import type { SKAppProps } from "../../src/public-api/react-types";

export const TestAtomRuntimeProvider = ({
  children,
  hostConfiguration,
  initialValues,
}: PropsWithChildren<{
  readonly hostConfiguration: SKAppProps;
  readonly initialValues?: ComponentProps<
    typeof RegistryProvider
  >["initialValues"];
}>) => (
  <RegistryProvider
    initialValues={[
      ...(initialValues ?? []),
      [
        applicationRuntimeInitAtom,
        {
          hostConfiguration,
          isLedgerLive: false,
          routes: applicationRoutes,
        },
      ],
    ]}
  >
    <WidgetConfigBoundaryAdapter hostConfiguration={hostConfiguration}>
      {children}
    </WidgetConfigBoundaryAdapter>
  </RegistryProvider>
);
