import classNames from "clsx";
import type { PropsWithChildren } from "react";
import { createElement } from "react";
import type { HeadingVariants } from "./styles.css";
import { heading } from "./styles.css";

type Props = PropsWithChildren<{ variant?: HeadingVariants }> &
  JSX.IntrinsicElements["h1"];

export const Heading = ({ children, variant, className, ...rest }: Props) => {
  return createElement(variant?.level ?? "h1", {
    className: classNames(heading(variant), className),
    children,
    ...rest,
  });
};
