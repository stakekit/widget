import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import * as stylex from "@stylexjs/stylex";
import {
  Fragment,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { HostHook } from "../host-hook";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { container } from "../tokens/container.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { motion } from "../tokens/motion.stylex";
import { opacity } from "../tokens/opacity.stylex";
import { pointer } from "../tokens/pointer.stylex";
import { gutter, presentationMarker } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import { hitArea, tokenTriggerHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import { focusRingStyles } from "./focus-ring";
import { hitAreaStyles } from "./hit-area";
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
  /**
   * What the count means, read in its place, such as "4 actions to take":
   * the tab shows the number and is named "Manage 4 actions to take".
   * Unset, the number alone is read.
   */
  readonly countLabel?: string;
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
   * account. From the `md` container size they keep the row and the tabs
   * scroll; narrower, the controls wrap under the tabs. Under the `outlined`
   * surface style with an underline, the rule runs under the whole row and
   * the selected tab's underline sits on it.
   */
  readonly trailing?: ReactNode;
};

/**
 * Tabs. Arrow keys move between tabs and Enter or Space selects one. The
 * indicator is an underline or a pill, as the tabs indicator presentation
 * setting asks; an underline's rule runs the full width of the row. Tabs
 * that do not fit scroll across, the cut-off ends fading out, and the
 * selected tab scrolls into view. The row is as tall as a pill `Tabs` list,
 * and taller under a coarse pointer, so each tab is an easy target.
 */
export const Tabs = <const T extends string>({
  tabs,
  value,
  onValueChange,
  label,
  children,
  trailing,
}: TabsProps<T>) => {
  const listRef = useRef<HTMLDivElement>(null);
  const hiddenEdges = useHiddenEdges(listRef, tabs);

  // Keeps the selected tab out of the faded ends, scrolling the row only.
  // `value` re-runs it after the selected tab changes; the effect reads the
  // selection from the DOM.
  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]'
    );
    if (!list || !selected) return;
    const inset = Number.parseFloat(getComputedStyle(list).scrollPaddingLeft);
    const start = selected.offsetLeft - inset;
    const end = selected.offsetLeft + selected.offsetWidth + inset;
    if (start < list.scrollLeft) list.scrollLeft = start;
    else if (end > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = end - list.clientWidth;
    }
  }, [value]);

  const list = (
    <div
      {...stylex.props(styles.rail, trailing !== undefined && styles.railInBar)}
    >
      <BaseTabs.List
        ref={listRef}
        aria-label={label}
        {...stylex.props(
          styles.list,
          trailing !== undefined && styles.listInBar,
          fadeStyles[hiddenEdges]
        )}
      >
        {/* First, so the tabs paint over the pill. */}
        <BaseTabs.Indicator {...stylex.props(styles.indicator)} />
        {tabs.map((tab) => (
          <Fragment key={tab.value}>
            {tab.separated === true && (
              <span aria-hidden="true" {...stylex.props(styles.separator)} />
            )}
            {/* The ring draws inside: the scrolling row would clip it. */}
            <BaseTabs.Tab
              value={tab.value}
              disabled={tab.disabled}
              data-rk={tab.hostHook}
              {...stylex.props(
                styles.tab,
                hitAreaStyles.coarse,
                focusRingStyles.visible,
                focusRingStyles.inset
              )}
            >
              {/* One inline run, so the space before the count stays. */}
              <span>
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <TabCount count={tab.count} label={tab.countLabel} />
                )}
              </span>
            </BaseTabs.Tab>
          </Fragment>
        ))}
      </BaseTabs.List>
    </div>
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

/** A tab's count; with a label, the label is read in place of the number. */
const TabCount = ({
  count,
  label,
}: {
  readonly count: number;
  readonly label: string | undefined;
}) => (
  <>
    {" "}
    <span
      aria-hidden={label === undefined ? undefined : true}
      {...stylex.props(styles.count, toneSoftStyles.warning)}
    >
      {count}
    </span>
    {label !== undefined && <VisuallyHidden>{label}</VisuallyHidden>}
  </>
);

type HiddenEdges = keyof typeof fadeStyles;

/** Which ends of a row scrolled across hide part of it. */
const hiddenEdgesOf = (row: HTMLElement): HiddenEdges => {
  const scrolled = Math.abs(row.scrollLeft);
  const start = scrolled > 1;
  const end = scrolled + row.clientWidth < row.scrollWidth - 1;
  if (start && end) return "both";
  if (start) return "start";
  if (end) return "end";
  return "none";
};

/**
 * The ends of the tabs' row that hide tabs, kept current as it scrolls, as
 * it or a tab resizes, and as the tabs change.
 */
const useHiddenEdges = (
  ref: RefObject<HTMLElement | null>,
  tabs: ReadonlyArray<TabOption>
) => {
  const [edges, setEdges] = useState<HiddenEdges>("none");

  useLayoutEffect(() => {
    const row = ref.current;
    // Read once the tabs it holds are known.
    if (row === null || tabs.length === 0) return;
    const update = () => setEdges(hiddenEdgesOf(row));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    for (const tab of row.children) observer.observe(tab);
    row.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      row.removeEventListener("scroll", update);
    };
  }, [ref, tabs]);

  return edges;
};

// A rule along the foot of a box, painted under what it holds: the
// underline's rule, which the selected tab's underline covers.
const footRule = `linear-gradient(to top, ${color.border} ${borderWidth.thin}, transparent ${borderWidth.thin})`;

// Each pill value sits under the ancestor condition inline: StyleX compiles
// `stylex.when` only where a style map uses it.
const styles = stylex.create({
  root: {
    gap: space[16],
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  // Holds the scrolling list and, under the underline, draws its rule the
  // full width of the row, unmoved as the tabs scroll and unfaded.
  rail: {
    alignSelf: "stretch",
    backgroundImage: {
      default: footRule,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "none",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: "none",
    },
    display: "flex",
    minWidth: 0,
  },
  // Beside controls, the rail takes the row's free space, so the rule runs
  // up to them; under `outlined` with an underline the row draws the rule.
  railInBar: {
    backgroundImage: {
      default: footRule,
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"][data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: "none",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "none",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: "none",
    },
    flexBasis: "auto",
    flexGrow: 1,
    flexShrink: 1,
  },
  // The row that scrolls the tabs across, its scrollbar hidden. A pill list
  // is the track; standalone, it spans the row.
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
    // The selected tab scrolls clear of a faded end.
    scrollPaddingInline: space[24],
    alignItems: "stretch",
    backgroundColor: {
      default: "transparent",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: color.surface,
    },
    boxSizing: "border-box",
    display: "flex",
    flexBasis: "auto",
    flexGrow: {
      default: 0,
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: 1,
    },
    flexShrink: 1,
    position: "relative",
    scrollbarWidth: "none",
    minHeight: {
      default: tokenTriggerHeight.tabs,
      [pointer.coarse]: hitArea.coarse,
    },
    minWidth: 0,
    overflowX: "auto",
    overflowY: "hidden",
    "::-webkit-scrollbar": { display: "none" },
  },
  // Beside controls, a pill track hugs its tabs; pills and tints sit level
  // with the controls, and an underline's tabs reach down to the rule.
  listInBar: {
    alignSelf: {
      default: "stretch",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="pill"]',
        presentationMarker
      )]: "center",
      [stylex.when.ancestor(
        '[data-sk-tabs-indicator="tint"]',
        presentationMarker
      )]: "center",
    },
    flexGrow: 0,
  },
  // The tabs' row with controls at its end. From `md` both keep one row and
  // the tabs scroll across behind their fade; narrower, the controls wrap
  // under the tabs. With the underline under the `outlined` surface style,
  // the row draws the rule across its full width, under the controls too.
  // With the tint, the rule runs edge to edge of the frame, under the row.
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
    backgroundImage: {
      default: "none",
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"][data-sk-tabs-indicator="underline"]',
        presentationMarker
      )]: footRule,
    },
    display: "flex",
    flexWrap: { default: "wrap", [container.md]: "nowrap" },
    justifyContent: "space-between",
    borderBottomColor: color.border,
    borderBottomStyle: "solid",
    borderBottomWidth: {
      default: 0,
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
  // Takes no room, and leaves no gap, while its controls render nothing.
  trailing: {
    alignSelf: "center",
    display: { default: "flex", ":empty": "none" },
    flexShrink: { default: 1, [container.md]: 0 },
    minWidth: 0,
  },
  // An accent underline under the selected tab, drawn over the rule so their
  // bottom edges meet; a raised pill behind the selected tab, in a track;
  // or, with the tint, a flat `surface` fill behind it, no track.
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
      default: 0,
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
  // Fills the row's height, its label centred in it.
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
    alignItems: "center",
    backgroundColor: "transparent",
    boxSizing: "border-box",
    color: {
      default: color.textMuted,
      ":hover:not([data-disabled])": color.text,
      ":is([data-active])": color.text,
    },
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    display: "inline-flex",
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

// Fades the ends of the tabs' row that hide tabs, as far as the scroll
// padding that keeps the selected tab clear of them.
const fadeStyles = stylex.create({
  none: {},
  start: {
    maskImage: `linear-gradient(to right, transparent, currentColor ${space[24]})`,
  },
  end: {
    maskImage: `linear-gradient(to left, transparent, currentColor ${space[24]})`,
  },
  both: {
    maskImage: `linear-gradient(to right, transparent, currentColor ${space[24]}, currentColor calc(100% - ${space[24]}), transparent)`,
  },
});
