import type { PropsWithChildren } from "react";
import type { SpinnerVariants } from "./style.css";
import { spinnerStyles } from "./style.css";

export const Spinner = ({
  variant,
}: PropsWithChildren<{ variant?: SpinnerVariants }>) => (
  <span className={spinnerStyles(variant)} />
);
