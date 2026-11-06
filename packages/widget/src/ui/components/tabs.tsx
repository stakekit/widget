import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import * as stylex from "@stylexjs/stylex";
import { Fragment, type ReactNode } from "react";
import type { HostHook } from "../host-hook";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { motion } from "../tokens/motion.stylex";
import { opacity } from "../tokens/opacity.stylex";
import { gutter, presentationMarker } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import { focusRingStyles } from "./focus-ring";
import { toneSoftStyles } from "./tone-styles";

/** One tab: what it stores and what it shows. */
export type TabOption<T extends string = string> = {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
  /**
   * A number beside the label that needs attention, such as positions with
   * an action to take, in the warning tone; part of the tab's name. Unset or
   * zero, none shows.
   */
  readonly count?: number;
  /** Draws a divider before the tab, so it starts a new group. */
  readonly separated?: boolean;
  /** Rendered on the tab as `data-rk`, where a host finds it. */
  readonly hostHook?: HostHook;
};

type TabsProps<T extends string> = {
  readonly tabs: ReadonlyArray<TabOption<T>>;
  readonly value: NoInfer<T>;
  readonly onValueChange: (value: T) => void;
  /** Names the tab list. */
  readonly label: string;
  /** The selected tab's content, in a panel the selected tab controls. */
  readonly children?: ReactNode;
  /**
   * Controls at the end of the tabs' row, such as a wallet's network and
   * account. Under the `outlined` surface style with an underline, the rule
   * runs under the whole row and the selected tab's underline sits on it.
   */
  readonly trailing?: ReactNode;
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
  trailing,
}: TabsProps<T>) => {
  const list = (
    <BaseTabs.List
      aria-label={label}
      {...stylex.props(styles.list, trailing !== undefined && styles.listInBar)}
    >
      {/* First, so the tabs paint over the pill. */}
      <BaseTabs.Indicator {...stylex.props(styles.indicator)} />
      {tabs.map((tab) => (
        <Fragment key={tab.value}>
          {tab.separated === true && (
            <span aria-hidden="true" {...stylex.props(styles.separator)} />
          )}
          {/* The ring draws inside: a bar that scrolls the tabs would clip it. */}
          <BaseTabs.Tab
            value={tab.value}
            disabled={tab.disabled}
            data-rk={tab.hostHook}
            {...stylex.props(
              styles.tab,
              focusRingStyles.visible,
              focusRingStyles.inset
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <>
                {" "}
                <span {...stylex.props(styles.count, toneSoftStyles.warning)}>
                  {tab.count}
                </span>
              </>
            )}
          </BaseTabs.Tab>
        </Fragment>
      ))}
    </BaseTabs.List>
  );

  return (
    <BaseTabs.Root
      value={value}
      onValueChange={(next) => {
        const tab = tabs.find((option) => option.value === next);
        if (tab) onValueChange(tab.value);
      }}
      {...stylex.props(styles.root)}
    >
      {trailing === undefined ? (
        list
      ) : (
        <div {...stylex.props(styles.bar)}>
          {list}
          <div {...stylex.props(styles.trailing)}>{trailing}</div>
        </div>
      )}
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
};

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
      )]: radius.pillControl,
    },
    gap: {
      default: space[16],
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: space[4],
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: space[4],
    },
    // The underline's rule runs only as wide as the tabs, not the bar.
    alignSelf: {
      default: "flex-start",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "stretch",
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
    // Only the underline draws a rule under the list.
    borderBottomColor: {
      default: color.border,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "transparent",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: "transparent",
    },
    borderBottomStyle: "solid",
    borderBottomWidth: borderWidth.thin,
  },
  // The tabs' row with controls at its end. With the underline under the
  // `outlined` surface style, the row draws the rule across its full width
  // and the list drops its own so its tabs sit on the row's rule. With the
  // tint, the rule runs edge to edge of the frame, under the row.
  bar: {
    gap: space[16],
    marginInline: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: `calc(-1 * ${gutter.size})`,
    },
    paddingInline: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: gutter.size,
    },
    alignItems: "stretch",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    borderBottomColor: color.border,
    borderBottomStyle: "solid",
    borderBottomWidth: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"][data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: borderWidth.thin,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: borderWidth.thin,
    },
    // As tight as the host's own header: 12px above the tabs, 8px to the rule,
    // pulling up into the frame's gutter above.
    marginTop: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: `calc(${space[12]} - ${gutter.size})`,
    },
    minWidth: 0,
    paddingBottom: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: space[8],
    },
  },
  listInBar: {
    alignItems: {
      default: "flex-end",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: "center",
    },
    alignSelf: "stretch",
    borderBottomWidth: {
      default: borderWidth.thin,
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"][data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: 0,
    },
  },
  trailing: { alignSelf: "center", display: "flex", minWidth: 0 },
  // An accent underline under the selected tab, drawn over the list's rule so
  // their bottom edges meet; a raised pill behind the selected tab, in a
  // track; or, with the tint, a flat `surface` fill behind it, no track.
  indicator: {
    borderRadius: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: radius.pillControl,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: radius.pillControl,
    },
    backgroundColor: {
      default: color.accent,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: color.surfaceRaised,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: color.surface,
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
      default: `calc(-1 * ${borderWidth.thin})`,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "auto",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: "auto",
    },
    height: {
      default: borderWidth.thick,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "var(--active-tab-height)",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
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
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
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
      )]: radius.pillControl,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: radius.pillControl,
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
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: space[16],
    },
    backgroundColor: "transparent",
    color: {
      default: color.textMuted,
      ":hover:not([data-disabled])": color.text,
      ":is([data-active])": color.text,
    },
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    flexShrink: 0,
    fontFamily: font.sans,
    fontSize: {
      default: fontSize.label,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: fontSize.body,
    },
    fontWeight: {
      default: fontWeight.medium,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: fontWeight.semibold,
    },
    lineHeight: {
      default: lineHeight.label,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: lineHeight.body,
    },
    opacity: { default: 1, ":is([data-disabled])": opacity.disabled },
    position: "relative",
    transitionDuration: motion.fast,
    transitionProperty: "color, opacity",
    transitionTimingFunction: motion.easing,
    whiteSpace: "nowrap",
  },
  panel: { borderRadius: radius.badge, minWidth: 0 },
  // A thin rule between two groups of tabs.
  separator: {
    alignSelf: "center",
    backgroundColor: color.border,
    flexShrink: 0,
    height: "1em",
    width: borderWidth.thin,
  },
  count: {
    borderRadius: radius.pill,
    paddingInline: space[6],
    display: "inline-block",
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.caption,
  },
});
