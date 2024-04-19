import type { PropsWithChildren } from "react";
import type { ButtonVariants } from "./styles.css";
import { buttonStyle } from "./styles.css";
import { Spinner } from "../spinner";

type Props = PropsWithChildren<{
  variant?: ButtonVariants;
  isLoading?: boolean;
}> &
  JSX.IntrinsicElements["button"];

export const Button = ({ children, variant, isLoading, ...rest }: Props) => (
  <button className={buttonStyle(variant)} {...rest}>
    {isLoading && <Spinner />}
    {children}
  </button>
);
