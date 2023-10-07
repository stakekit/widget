import { PropsWithChildren } from "react";
import { ItemContainerVariants, itemContainer } from "./styles.css";
import { Box } from "../box";

export const ListItem = ({
  children,
  onClick,
  testId,
  variant,
}: PropsWithChildren<{
  onClick?: () => void;
  testId?: string;
  variant?: ItemContainerVariants;
}>) => {
  return (
    <Box
      className={itemContainer(variant)}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </Box>
  );
};
