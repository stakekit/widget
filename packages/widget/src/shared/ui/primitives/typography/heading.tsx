import classNames from "clsx";
import type { JSX, PropsWithChildren } from "react";
import { Box, type BoxProps } from "../box";
import type { HeadingVariants } from "./styles.css";
import { heading } from "./styles.css";

type Props = PropsWithChildren<{ variant?: HeadingVariants }> &
  JSX.IntrinsicElements["h1"] &
  BoxProps;

export const Heading = ({ children, variant, className, ...rest }: Props) => {
  return (
    <Box
      as={variant?.level ?? "h1"}
      className={classNames(heading(variant), className)}
      {...rest}
    >
      {children}
    </Box>
  );
};
