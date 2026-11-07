import * as stylex from "@stylexjs/stylex";
import { createElement, type ReactNode } from "react";
import {
  flexItemStyles,
  layoutStyles,
  paddingBlockStyles,
  paddingInlineStyles,
  type Responsive,
  type Space,
} from "../primitives/layout";
import { borderWidth, insetEdge } from "../tokens/border.stylex";
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
   * it, `field` frames an input. Under the `elevated` surface style, `filled`
   * and `field` lift off it as `raised`; under `outlined`, `filled` keeps its
   * fill and edges in the `border` role, and `field` takes the canvas's fill
   * inside a `borderStrong` edge.
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
  /** Takes the remaining space in a parent row or column. */
  readonly grow?: boolean;
  /**
   * Edges the card in the accent while focus is inside it, for a card that
   * frames a field drawn without an edge of its own, such as an amount.
   */
  readonly focusEdge?: boolean;
  /**
   * Edges the card in `danger`, such as a field card whose amount cannot be
   * used; a focus edge still shows over it.
   */
  readonly invalid?: boolean;
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
    grow = false,
    focusEdge = false,
    invalid = false,
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
    selected && interactiveStyles.selected,
    grow && flexItemStyles.grow,
    invalid && invalidStyles.root,
    focusEdge && focusEdgeStyles.root
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
// surfaces off the canvas; `outlined` edges them in `border`.
const variantStyles = stylex.create({
  filled: {
    borderColor: {
      default: "transparent",
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"]',
        presentationMarker
      )]: color.border,
    },
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
  // A card framing an input, such as an amount: filled like `filled`, but
  // under the `outlined` surface style it reads as an input, the canvas's
  // fill inside a `borderStrong` edge.
  field: {
    borderColor: {
      default: "transparent",
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"]',
        presentationMarker
      )]: color.borderStrong,
    },
    backgroundColor: {
      default: color.surface,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: color.surfaceRaised,
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"]',
        presentationMarker
      )]: color.background,
    },
    boxShadow: {
      default: null,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: elevation.raised,
    },
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
  field: {
    backgroundColor: {
      default: color.surface,
      ":hover:not(:disabled)": color.surfaceHover,
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

// After the variant and tone edges, so it wins over them; the focus edge is
// an outline, so it still draws over it.
const invalidStyles = stylex.create({
  root: { borderColor: color.danger },
});

const focusEdgeStyles = stylex.create({
  // An outline over the card's own edge, so its variant and tone edges stay
  // as they are while nothing inside is focused.
  root: {
    outlineColor: color.accent,
    outlineOffset: insetEdge.offset,
    outlineStyle: { default: "none", ":focus-within": "solid" },
    outlineWidth: borderWidth.thin,
  },
});
