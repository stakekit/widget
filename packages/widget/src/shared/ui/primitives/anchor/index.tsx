import type { PropsWithChildren } from "react";
import { Box } from "../box";
import { container } from "./style.css";

export const SKAnchor = (props: PropsWithChildren<{ href?: string }>) => {
  return (
    <Box
      className={container}
      as="a"
      href={
        props.href ?? (typeof props.children === "string" ? props.children : "")
      }
      target="_blank"
    >
      {props.children ?? props.href}
    </Box>
  );
};
