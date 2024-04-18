import type { PropsWithChildren } from "react";
import type { ItemContainerVariants } from "./styles.css";
import { itemContainer } from "./styles.css";
import type { BoxProps } from "../box";
import { Box } from "../box";
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
