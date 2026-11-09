import * as stylex from "@stylexjs/stylex";
import { createElement, type ReactNode } from "react";
import { visuallyHiddenBox } from "../tokens/size.stylex";

/**
 * Content for assistive technology only: read aloud, never painted. As a
 * `status`, it announces its changes politely.
 */
export const VisuallyHidden = ({
  as = "span",
  role,
  children,
}: {
  readonly as?: "span" | "div";
  readonly role?: "status";
  readonly children?: ReactNode;
}) => createElement(as, { role, ...stylex.props(styles.root) }, children);

const styles = stylex.create({
  root: {
    margin: visuallyHiddenBox.margin,
    padding: 0,
    borderWidth: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    position: "absolute",
    whiteSpace: "nowrap",
    height: visuallyHiddenBox.size,
    width: visuallyHiddenBox.size,
  },
});
