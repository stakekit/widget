import { PropsWithChildren } from "react";
import { ItemContainerVariants, itemContainer } from "./styles.css";
import { Box, BoxProps } from "../box";
import clsx from "clsx";

export const ListItem = ({
  children,
  onClick,
  testId,
  variant,
  className,
  ...rest
}: PropsWithChildren<
  {
    onClick?: () => void;
    testId?: string;
    variant?: ItemContainerVariants;
  } & BoxProps
>) => {
  return (
    <Box
      className={clsx(itemContainer(variant), className)}
      onClick={onClick}
      data-testid={testId}
      {...rest}
    >
      {children}
    </Box>
  );
};
