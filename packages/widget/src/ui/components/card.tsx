import * as stylex from "@stylexjs/stylex";
import { createElement, type ReactNode } from "react";
import {
  layoutStyles,
  paddingBlockStyles,
  paddingInlineStyles,
  type Responsive,
  type Space,
} from "../primitives/layout";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { presentationMarker } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import type { Tone } from "../tone";
import { interactiveStyles } from "./interactive-styles";
import { toneBorderStyles, toneSoftStyles } from "./tone-styles";

type CommonProps = {
  /**
   * `filled` sits on the canvas, `outline` draws an edge, `raised` lifts off
   * it. Under the `elevated` surface style, `filled` lifts off it as `raised`.
   */
  readonly variant?: keyof typeof variantStyles;
  readonly padding?: Responsive<Space>;
  /** Tints the surface with a tone's soft color; outlined cards also edge in it. */
  readonly tone?: Tone;
  /** Marks the card as the chosen one: a ring plus the accent tint. */
  readonly selected?: boolean;
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
  readonly children?: ReactNode;
  /** Renders as the card's `data-testid`. */
  readonly testId?: string;
};

type CardProps = CommonProps &
  (
    | {
        /** Makes the whole card a button. */
        readonly onClick: () => void;
        readonly disabled?: boolean;
        readonly as?: never;
        readonly href?: never;
      }
    | {
        /** Makes the whole card a link. */
        readonly href: string;
        readonly target?: "_blank";
        readonly onClick?: never;
        readonly as?: never;
      }
    | {
        readonly as?: "div" | "section" | "article" | "li";
        readonly onClick?: never;
        readonly href?: never;
      }
  );

/**
 * A surface that groups content. With `onClick` it is a button and with
 * `href` a link, so the whole card is one keyboard stop; `selected` then
 * reads as pressed (or current, for a link).
 */
export const Card = (props: CardProps) => {
  const {
    variant = "filled",
    padding = 16,
    tone = "neutral",
    selected,
    children,
  } = props;
  const interactive = props.onClick !== undefined || props.href !== undefined;
  const styleProps = stylex.props(
    styles.root,
    layoutStyles.paddingBlock,
    layoutStyles.paddingInline,
    paddingBlockStyles(padding),
    paddingInlineStyles(padding),
    variantStyles[variant],
    interactive && interactiveStyles.root,
    interactive && hoverStyles[variant],
    tone !== "neutral" && toneSoftStyles[tone],
    tone !== "neutral" && interactive && toneHoverStyles[tone],
    tone !== "neutral" && variant === "outline" && toneBorderStyles[tone],
    selected && interactiveStyles.selected
  );
  const labelling = {
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "data-testid": props.testId,
  };

  if (props.onClick !== undefined) {
    return (
      <button
        {...labelling}
        {...styleProps}
        type="button"
        onClick={props.onClick}
        disabled={props.disabled}
        aria-pressed={selected}
      >
        {children}
      </button>
    );
  }

  if (props.href !== undefined) {
    return (
      <a
        {...labelling}
        {...styleProps}
        href={props.href}
        target={props.target}
        rel={props.target === "_blank" ? "noreferrer" : undefined}
        aria-current={selected || undefined}
      >
        {children}
      </a>
    );
  }

  return createElement(
    props.as ?? "div",
    { ...labelling, ...styleProps },
    children
  );
};

const styles = stylex.create({
  root: {
    margin: 0,
    borderColor: "transparent",
    borderRadius: radius.card,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    boxSizing: "border-box",
    color: color.text,
    display: "block",
    minWidth: 0,
  },
});

// The `elevated` surface style, which the theme root carries, lifts filled
// surfaces off the canvas.
const variantStyles = stylex.create({
  filled: {
    backgroundColor: {
      default: color.surface,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: color.surfaceRaised,
    },
    boxShadow: {
      default: null,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: elevation.raised,
    },
  },
  outline: {
    borderColor: color.borderStrong,
    backgroundColor: "transparent",
  },
  raised: {
    backgroundColor: color.surfaceRaised,
    boxShadow: elevation.raised,
  },
});

// The hover rule's `:not(:disabled)` outranks the ancestor condition, so a
// hovered elevated card still moves to the hover surface.
const hoverStyles = stylex.create({
  filled: {
    backgroundColor: {
      default: color.surface,
      ":hover:not(:disabled)": color.surfaceHover,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: color.surfaceRaised,
    },
  },
  outline: {
    backgroundColor: {
      default: "transparent",
      ":hover:not(:disabled)": color.surfaceHover,
    },
  },
  raised: {
    backgroundColor: {
      default: color.surfaceRaised,
      ":hover:not(:disabled)": color.surfaceHover,
    },
  },
});

// A toned card keeps its tint and moves it toward the hover surface, as an
// untoned card moves from its surface to the hover surface.
const toneHoverStyles = stylex.create({
  accent: {
    backgroundColor: {
      default: color.accentSoft,
      ":hover:not(:disabled)": `color-mix(in srgb, ${color.accentSoft}, ${color.surfaceHover})`,
    },
  },
  success: {
    backgroundColor: {
      default: color.successSoft,
      ":hover:not(:disabled)": `color-mix(in srgb, ${color.successSoft}, ${color.surfaceHover})`,
    },
  },
  warning: {
    backgroundColor: {
      default: color.warningSoft,
      ":hover:not(:disabled)": `color-mix(in srgb, ${color.warningSoft}, ${color.surfaceHover})`,
    },
  },
  danger: {
    backgroundColor: {
      default: color.dangerSoft,
      ":hover:not(:disabled)": `color-mix(in srgb, ${color.dangerSoft}, ${color.surfaceHover})`,
    },
  },
  info: {
    backgroundColor: {
      default: color.infoSoft,
      ":hover:not(:disabled)": `color-mix(in srgb, ${color.infoSoft}, ${color.surfaceHover})`,
    },
  },
});
