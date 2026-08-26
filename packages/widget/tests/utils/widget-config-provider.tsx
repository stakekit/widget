import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";
import { WidgetConfigBoundaryAdapter } from "../../src/app/composition/providers/widget-config-binding";
import { applicationRuntimeInitAtom } from "../../src/app/runtime/application-runtime-init";
import type { VariantProps } from "../../src/public-api/react-types";
import type { SettingsProps } from "../../src/public-api/types";

export const TestWidgetConfigProvider = ({
  children,
  ...props
}: PropsWithChildren<SettingsProps & VariantProps>) => {
  return (
    <RegistryProvider
      initialValues={[
        [
          applicationRuntimeInitAtom,
          {
            hostConfiguration: props,
            isLedgerLive: false,
            routes: [{ path: "*" }],
          },
        ],
      ]}
    >
      <WidgetConfigBoundaryAdapter hostConfiguration={props}>
        {children}
      </WidgetConfigBoundaryAdapter>
    </RegistryProvider>
  );
};
