import type { ReactNode } from "react";
import { Stack, Text } from "../../../../../ui/index";

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

/** The back button, then the trail from the positions list to this position. */
export const PositionDetailsBreadcrumb = ({
  backButton,
  positionName,
  rootLabel,
}: {
  readonly backButton: ReactNode;
  readonly positionName: string | null;
  readonly rootLabel: string;
}) => (
  <Stack direction="row" align="center" gap={8}>
    {backButton}
    <Text weight="semibold">{rootLabel}</Text>
    {positionName ? (
      <Text tone="muted" truncate>
        {`/ ${positionName}`}
      </Text>
    ) : null}
  </Stack>
);
