import { RegistryProvider } from "@effect/atom-react";
import type { ComponentProps, PropsWithChildren } from "react";
import { WidgetConfigBoundaryAdapter } from "../../src/app/composition/providers/widget-config-binding";
import { applicationRoutes } from "../../src/app/routes/application-routes";
import { applicationRuntimeInitAtom } from "../../src/app/runtime/application-runtime-init";
import type { SKAppProps } from "../../src/public-api/react-types";
import type { WidgetConfig } from "../../src/services/config/widget-config-model";

export const TestAtomRuntimeProvider = ({
  children,
  initialValues,
  settings,
}: PropsWithChildren<{
  readonly initialValues?: ComponentProps<
    typeof RegistryProvider
  >["initialValues"];
  readonly settings: WidgetConfig;
}>) => {
  const hostConfiguration = settings as unknown as SKAppProps;

  return (
    <RegistryProvider
      initialValues={[
        ...(initialValues ?? []),
        [
          applicationRuntimeInitAtom,
          {
            hostConfiguration,
            isLedgerLive: settings.isLedgerLive,
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
};
