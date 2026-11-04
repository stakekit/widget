import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { IconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import type { Tone } from "../tone";
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
 * an optional action below the body.
 */
export const Notice = ({
  tone = "info",
  title,
  children,
  action,
}: {
  readonly tone?: Tone;
  readonly title?: string;
  /** The message. */
  readonly children: ReactNode;
  /** A button or link that resolves the notice. */
  readonly action?: ReactNode;
}) => (
  <div {...stylex.props(styles.root, toneSoftStyles[tone])}>
    <span {...stylex.props(styles.icon, toneTextStyles[tone])}>
      <Icon name={toneIcons[tone]} size="md" />
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
