import type { PropsWithChildren } from "react";
import type { BoxProps } from "../../components/atoms/box";
import { Box } from "../../components/atoms/box";

export const PageContainer = ({
  children,
  ...rest
}: PropsWithChildren<BoxProps>) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      px="4"
      marginBottom="4"
      flex={1}
      paddingTop="2"
      {...rest}
    >
      {children}
    </Box>
  );
};
