import { Children, type PropsWithChildren, type ReactNode } from "react";
import { Box } from "../box";
import { container } from "./style.css";

/** A translation places a link's URL as its text, possibly split in parts. */
const textHref = (children: ReactNode) =>
  Children.toArray(children)
    .filter((child) => typeof child === "string")
    .join("");

export const SKAnchor = (props: PropsWithChildren<{ href?: string }>) => {
  return (
    <Box
      className={container}
      as="a"
      href={props.href ?? textHref(props.children)}
      target="_blank"
    >
      {props.children ?? props.href}
    </Box>
  );
};
