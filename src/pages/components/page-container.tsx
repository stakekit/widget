import { PropsWithChildren } from "react";
import { Box, BoxProps } from "../../components/atoms/box";

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
