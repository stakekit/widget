import { RegistryProvider } from "@effect/atom-react";
import type { PropsWithChildren } from "react";

import { WidgetConfigBoundaryAdapter } from "../../src/app/composition/providers/widget-config-binding";
import type { VariantProps } from "../../src/public-api/react-types";
import type { SettingsProps } from "../../src/public-api/types";
import { applicationRuntimeInitAtom } from "../../src/runtime/application-runtime-init";

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
