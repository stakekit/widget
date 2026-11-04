import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { motion } from "../tokens/motion.stylex";
import { presentationMarker } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import { focusRingStyles } from "./focus-ring";

/** One tab: what it stores and what it shows. */
export type TabOption<T extends string = string> = {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
};

type TabsProps<T extends string> = {
  readonly tabs: ReadonlyArray<TabOption<T>>;
  readonly value: NoInfer<T>;
  readonly onValueChange: (value: T) => void;
  /** Names the tab list. */
  readonly label: string;
  /** The selected tab's content, in a panel the selected tab controls. */
  readonly children?: ReactNode;
};

/**
 * Tabs. Arrow keys move between tabs and Enter or Space selects one. The
 * indicator is an underline or a pill, as the tabs indicator presentation
 * setting asks.
 */
export const Tabs = <const T extends string>({
  tabs,
  value,
  onValueChange,
  label,
  children,
}: TabsProps<T>) => (
  <BaseTabs.Root
    value={value}
    onValueChange={(next) => {
      const tab = tabs.find((option) => option.value === next);
      if (tab) onValueChange(tab.value);
    }}
    {...stylex.props(styles.root)}
  >
    <BaseTabs.List aria-label={label} {...stylex.props(styles.list)}>
      {/* First, so the tabs paint over the pill. */}
      <BaseTabs.Indicator {...stylex.props(styles.indicator)} />
      {tabs.map((tab) => (
        <BaseTabs.Tab
          key={tab.value}
          value={tab.value}
          disabled={tab.disabled}
          {...stylex.props(styles.tab, focusRingStyles.visible)}
        >
          {tab.label}
        </BaseTabs.Tab>
      ))}
    </BaseTabs.List>
    {children !== undefined && (
      <BaseTabs.Panel
        value={value}
        {...stylex.props(styles.panel, focusRingStyles.visible)}
      >
        {children}
      </BaseTabs.Panel>
    )}
  </BaseTabs.Root>
);

// Each pill value sits under the ancestor condition inline: StyleX compiles
// `stylex.when` only where a style map uses it.
const styles = stylex.create({
  root: {
    gap: space[16],
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  list: {
    padding: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: space[4],
    },
    borderRadius: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: radius.pill,
    },
    gap: {
      default: space[16],
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: space[4],
    },
    backgroundColor: {
      default: "transparent",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: color.surface,
    },
    display: "flex",
    position: "relative",
    borderBottomColor: {
      default: color.border,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "transparent",
    },
    borderBottomStyle: "solid",
    borderBottomWidth: borderWidth.thin,
  },
  // An accent underline under the selected tab, or a raised pill behind it.
  indicator: {
    borderRadius: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: radius.pill,
    },
    backgroundColor: {
      default: color.accent,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: color.surfaceRaised,
    },
    boxShadow: {
      default: "none",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: elevation.raised,
    },
    position: "absolute",
    transitionDuration: motion.base,
    transitionProperty: "left, top, width, height",
    transitionTimingFunction: motion.easing,
    bottom: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "auto",
    },
    height: {
      default: borderWidth.thick,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "var(--active-tab-height)",
    },
    left: "var(--active-tab-left)",
    top: {
      default: "auto",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "var(--active-tab-top)",
    },
    width: "var(--active-tab-width)",
  },
  tab: {
    margin: 0,
    borderRadius: {
      default: radius.badge,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: radius.pill,
    },
    borderStyle: "none",
    paddingBlock: {
      default: space[8],
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: space[6],
    },
    paddingInline: {
      default: space[4],
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: space[12],
    },
    backgroundColor: "transparent",
    color: {
      default: color.textMuted,
      ":hover:not([data-disabled])": color.text,
      ":is([data-active])": color.text,
      ":is([data-disabled])": color.textSubtle,
    },
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    flexShrink: 0,
    fontFamily: font.sans,
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.label,
    position: "relative",
    transitionDuration: motion.fast,
    transitionProperty: "color",
    transitionTimingFunction: motion.easing,
    whiteSpace: "nowrap",
  },
  panel: { borderRadius: radius.badge, minWidth: 0 },
});
