import type { PropsWithChildren } from "react";
import type { BoxProps } from "../../components/atoms/box";
import { Box } from "../../components/atoms/box";
import { BackButton } from "../../pages-dashboard/common/components/back-button";
import { useSettings } from "../../providers/settings";

export const PageContainer = ({
  children,
  ...rest
}: PropsWithChildren<BoxProps>) => {
  const { dashboardVariant } = useSettings();

  return (
    <Box
      data-rk="page-container"
      display="flex"
      flexDirection="column"
      px={dashboardVariant ? "0" : "4"}
      marginBottom="4"
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
