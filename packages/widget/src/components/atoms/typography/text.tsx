import classNames from "clsx";
import type { PropsWithChildren } from "react";
import { Box } from "../box";
import type { BoxProps } from "../box";
import type { TextVariants } from "./styles.css";
import { textStyles } from "./styles.css";

type Props = PropsWithChildren<{ variant?: TextVariants }> & BoxProps;

export const Text = ({ children, variant, className, ...rest }: Props) => {
  return (
    <Box
      as="p"
      className={classNames(className, textStyles(variant))}
      {...rest}
    >
      {children}
    </Box>
  );
};
