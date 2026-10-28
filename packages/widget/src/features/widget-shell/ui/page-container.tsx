import type { PropsWithChildren } from "react";
import type { BoxProps } from "../../../shared/ui/primitives/box";
import { Box } from "../../../shared/ui/primitives/box";
import { BackButton } from "./back-button";
import { pageContainer } from "./layout.css";

export const PageContainer = ({
  children,
  ...rest
}: PropsWithChildren<BoxProps>) => (
  <Box
    data-rk="page-container"
    display="flex"
    flexDirection="column"
    flex={1}
    className={pageContainer}
    {...rest}
  >
    <BackButton />
    {children}
  </Box>
);
