import type { PropsWithChildren } from "react";
import { useWidgetConfig } from "../../../app/config/use-widget-config";
import type { BoxProps } from "../../../shared/ui/primitives/box";
import { Box } from "../../../shared/ui/primitives/box";
import { BackButton } from "../dashboard/components/back-button";

export const PageContainer = ({
  children,
  ...rest
}: PropsWithChildren<BoxProps>) => {
  const dashboardVariant = useWidgetConfig("dashboardVariant");

  return (
    <Box
      data-rk="page-container"
      display="flex"
      flexDirection="column"
      px={dashboardVariant ? "0" : "4"}
      flex={1}
      paddingTop={dashboardVariant ? "0" : "2"}
      gap={dashboardVariant ? "2" : "0"}
      {...rest}
    >
      <BackButton />
      {children}
    </Box>
  );
};
