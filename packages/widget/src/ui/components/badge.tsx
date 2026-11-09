import * as stylex from "@stylexjs/stylex";

import type { FixedIconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { borderWidth } from "../tokens/border.stylex";
import { badgeTint, color } from "../tokens/color.stylex";
import { container } from "../tokens/container.stylex";
import { presentationMarker } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import { visuallyHiddenBox } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import type { Tone } from "../tone";
import { toneBorderStyles, toneTextStyles } from "./tone-styles";

/**
 * A short status label: `soft` tinted and edged in its tone over the
 * surface it sits on, `outline` edged in the tone itself. With an icon,
 * `collapse="belowSm"` shows only the icon below the `sm` container size, so
 * the text beside it keeps its room; the label stays for screen readers.
 */
export const Badge = ({
  tone = "neutral",
  variant = "soft",
  icon,
  collapse,
  testId,
  role,
  children,
}: {
  readonly tone?: Tone;
  readonly variant?: "soft" | "outline";
  /** A decorative icon before the label. */
  readonly icon?: FixedIconName;
  /** Below `sm`, show only the icon (requires `icon`). */
  readonly collapse?: "belowSm";
  readonly children: string;
  /** Rendered as `data-testid`. */
  readonly testId?: string;
  /** `status` announces the label politely when it changes or appears. */
  readonly role?: "status";
}) => {
  const collapses = collapse === "belowSm" && icon !== undefined;

  return (
    <span
      data-testid={testId}
      role={role}
      {...stylex.props(
        styles.root,
        collapses && styles.rootCollapsed,
        toneTextStyles[tone],
        variant === "soft"
          ? [styles.soft, tone === "neutral" && styles.softNeutral]
          : [styles.outline, toneBorderStyles[tone]]
      )}
    >
      {icon && <Icon name={icon} size="sm" />}
      {collapses ? (
        <span {...stylex.props(styles.labelFromSm)}>{children}</span>
      ) : (
        children
      )}
    </span>
  );
};

const styles = stylex.create({
  root: {
    borderColor: "transparent",
    borderRadius: radius.badge,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[4],
    paddingBlock: space[2],
    paddingInline: space[8],
    alignItems: "center",
    boxSizing: "border-box",
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: font.sans,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.caption,
    whiteSpace: "nowrap",
  },
  rootCollapsed: {
    paddingInline: { default: space[4], [container.sm]: space[8] },
    position: "relative",
  },
  labelFromSm: {
    margin: { default: visuallyHiddenBox.margin, [container.sm]: 0 },
    overflow: "hidden",
    clipPath: { default: "inset(50%)", [container.sm]: "none" },
    position: { default: "absolute", [container.sm]: "static" },
    height: { default: visuallyHiddenBox.size, [container.sm]: "auto" },
    width: { default: visuallyHiddenBox.size, [container.sm]: "auto" },
  },
  outline: { backgroundColor: "transparent" },
  // The tone's text color, `currentColor`, mixed into `surface`: the fill
  // stays faint so the text keeps its contrast, and the edge carries the
  // badge's shape on a row. Under the `elevated` surface style cards are
  // `surfaceRaised`, so the fill mixes into that instead and the badge reads
  // as a light, edged tag rather than a grey fill; the edge stays as strong.
  soft: {
    borderColor: `color-mix(in srgb, currentColor ${badgeTint.edge}, ${color.surface})`,
    backgroundColor: {
      default: `color-mix(in srgb, currentColor ${badgeTint.fill}, ${color.surface})`,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]:
        `color-mix(in srgb, currentColor ${badgeTint.fill}, ${color.surfaceRaised})`,
    },
  },
  // Text reads stronger than a hue, so its edge takes less of it.
  softNeutral: {
    borderColor: `color-mix(in srgb, currentColor ${badgeTint.neutralEdge}, ${color.surface})`,
  },
});
