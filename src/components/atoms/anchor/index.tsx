import { PropsWithChildren } from "react";
import { Box } from "../box";
import { container } from "./style.css";

export const SKAnchor = (props: PropsWithChildren) => {
  return (
    <Box
      className={container}
      as="a"
      href={(props.children as string) ?? ""}
      target="_blank"
    >
      {props.children}
    </Box>
  );
};
