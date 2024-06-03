import type { PropsWithChildren } from "react";
import type { LinkProps } from "react-router-dom";
import { Link } from "react-router-dom";
import { link } from "./styles.css";

export const SKLink = ({ children, ...rest }: PropsWithChildren<LinkProps>) => {
  return (
    <Link className={link} {...rest}>
      {children}
    </Link>
  );
};
