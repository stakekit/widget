import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { IconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import type { Tone } from "../tone";
import { Spinner } from "./spinner";
import { toneSoftStyles, toneTextStyles } from "./tone-styles";

const toneIcons = {
  neutral: "InfoIcon",
  accent: "InfoIcon",
  info: "InfoIcon",
  success: "CheckCircleIcon",
  warning: "WarningIcon",
  danger: "WarningIcon",
} as const satisfies Record<Tone, IconName>;

/**
 * A message on its tone's tint, with the tone's icon, an optional title and
 * an optional action below the body. While `busy`, a spinner replaces the
 * icon and the notice reads as busy.
 */
export const Notice = ({
  tone = "info",
  title,
  children,
  action,
  busy = false,
  testId,
}: {
  readonly tone?: Tone;
  readonly title?: string;
  /** The message. */
  readonly children: ReactNode;
  /** A button or link that resolves the notice. */
  readonly action?: ReactNode;
  /** The work the notice describes is in progress, such as a status check. */
  readonly busy?: boolean;
  /** Rendered as `data-testid`. */
  readonly testId?: string;
}) => (
  <div
    data-testid={testId}
    aria-busy={busy || undefined}
    {...stylex.props(styles.root, toneSoftStyles[tone])}
  >
    <span {...stylex.props(styles.icon, toneTextStyles[tone])}>
      {busy ? <Spinner size="md" /> : <Icon name={toneIcons[tone]} size="md" />}
    </span>
    <Stack gap={8} grow>
      <Stack gap={2}>
        {title && (
          <Text variant="label" weight="semibold">
            {title}
          </Text>
        )}
        {/* The body reads in the text color; the tone shows in the title, icon and tint. */}
        <Text tone="default">{children}</Text>
      </Stack>
      {action && (
        <Stack direction="row" gap={8} wrap>
          {action}
        </Stack>
      )}
    </Stack>
  </div>
);

const styles = stylex.create({
  root: {
    borderRadius: radius.control,
    gap: space[12],
    paddingBlock: space[12],
    paddingInline: space[16],
    alignItems: "flex-start",
    boxSizing: "border-box",
    display: "flex",
  },
  icon: { display: "flex", flexShrink: 0 },
});
