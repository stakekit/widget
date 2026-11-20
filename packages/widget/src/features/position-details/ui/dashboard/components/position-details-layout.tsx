import type { ReactNode } from "react";

import { Stack } from "../../../../../ui/index";

/**
 * One side of the position details split view: its actions or its facts. It
 * fills the pane as a column, so what grows in it reaches the pane's foot.
 */
export const PositionDetailsPane = ({
  children,
  kind,
}: {
  readonly children: ReactNode;
  readonly kind: "actions" | "info";
}) => (
  <Stack grow gap={kind === "actions" ? 16 : 24}>
    {children}
  </Stack>
);
