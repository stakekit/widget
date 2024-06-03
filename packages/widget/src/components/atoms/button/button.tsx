import type { PropsWithChildren } from "react";
import { Spinner } from "../spinner";
import type { ButtonVariants } from "./styles.css";
import { buttonStyle } from "./styles.css";

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
