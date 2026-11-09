import * as stylex from "@stylexjs/stylex";
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  use,
  useId,
} from "react";
import type { FixedIconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { borderWidth, focusRing, insetEdge } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { container } from "../tokens/container.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { presentationMarker } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import {
  iconSize,
  listRowHeight,
  selectionControlSize,
  visuallyHiddenBox,
} from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { CopyButton } from "./copy-button";
import { interactiveStyles } from "./interactive-styles";
import { Spinner } from "./spinner";
import { toneTextStyles } from "./tone-styles";
import { useCopy } from "./use-copy";

/**
 * `condensed` is a shorter row, for a compact choice such as a network, an
 * account or a wallet. Its avatar takes the `control` size, or `sm` in a 40px
 * row. A condensed row is `flat`.
 */
type ListRowDensity = "comfortable" | "condensed";

/**
 * One row look per context. `card` is for lists of what the user owns or
 * did, such as positions or activity: each row a filled surface, a selection
 * ring for `selected`. `flat` is for pickers, every `SelectSheet` among them:
 * no surface of its own, a tint on hover, and the accent tint with a
 * trailing check for `selected`. A flat row given `selected` or `option`
 * keeps the check's slot while unchosen too, so the values of a choice's
 * rows line up.
 */
type ListRowVariant = "card" | "flat";

/** Set inside a `ListGroup`: its rows' density. */
const InListGroup = createContext<
  { readonly density: ListRowDensity } | undefined
>(undefined);

/** A state on a row's second line, such as "Action required". */
type ListRowStatus = {
  readonly text: string;
  readonly tone: "neutral" | "success" | "warning" | "danger" | "info";
  /** A small leading icon, such as `WarningIcon`. */
  readonly icon?: FixedIconName;
};

/** A line under a `ListRow`'s main line, such as why its switch is blocked. */
type ListRowNote = {
  readonly text: string;
  readonly tone: "warning" | "danger";
};

/** One label-value row under a `ListRow`'s main line. */
type ListRowDetail = {
  readonly label: string;
  readonly value: string;
  /** Copies `value` in full, whatever the detail shows. */
  readonly copy?: {
    readonly value: string;
    /** Names the copy control, such as "Copy address". */
    readonly label: string;
    /** Announced once copied, such as "Copied". */
    readonly copiedLabel: string;
  };
};

type CommonProps = {
  /** An avatar: `TokenAvatar`, `Avatar` or an icon. */
  readonly leading?: ReactNode | undefined;
  readonly title: string;
  readonly subtitle?: string | undefined;
  /**
   * Badges beside the title; below the `sm` container size they move to the
   * second line, so the title keeps its room.
   */
  readonly badges?: ReactNode | undefined;
  /**
   * A state after the subtitle on the second line, as colored text with an
   * optional icon rather than a chip, such as "⚠ Action required". The
   * subtitle keeps its room: the state's text truncates first, and below the
   * `sm` container size a state with an icon shows the icon alone, its text
   * still read.
   */
  readonly status?: ListRowStatus;
  /** Unset, the row takes its `ListGroup`'s density, else `comfortable`. */
  readonly density?: ListRowDensity;
  /** Unset, `card`. A condensed row is always `flat`. */
  readonly variant?: ListRowVariant;
  /**
   * The trailing figure, such as a formatted balance. It never wraps: the
   * title truncates first.
   */
  readonly value?: string | undefined;
  /**
   * The value did not happen, such as a failed transfer's amount: it reads
   * muted and struck through.
   */
  readonly valueStruck?: boolean;
  /**
   * A figure before the value column, such as a reward rate. `success` is
   * for positive rates and claimable amounts only; `muted` is for a rate of
   * zero or none, such as "—". With `from` it shows only from that container
   * size up, so a narrow row keeps room for its title.
   */
  readonly figure?: {
    readonly text: string;
    readonly tone?: "default" | "success" | "muted";
    readonly from?: "sm";
  };
  /**
   * An element at the row's end, after the value column or in its place,
   * centered on the row, such as an "Install" `Badge`. It never shrinks: the
   * title truncates first.
   */
  readonly trailing?: ReactNode;
  /** Context under the value, such as its fiat equivalent. */
  readonly subvalue?: string | undefined;
  /**
   * Label-value rows under the row's main line, such as a validator's
   * commission and staked balance. A detail with `copy` copies its value
   * without pressing the row: a copy button follows the row, outside its own
   * control, or, as a listbox holds options only, a pointer's press on a copy
   * icon beside the detail copies in place of choosing the option.
   */
  readonly details?: ReadonlyArray<ListRowDetail> | undefined;
  /**
   * A line under the row's main line and details, across the row, such as
   * why the row's switch cannot change: `danger` for what blocks it,
   * `warning` for a risk to weigh.
   */
  readonly note?: ListRowNote | undefined;
  /** Renders as the row's `data-testid`. */
  readonly testId?: string | undefined;
  /**
   * Work on the row is in progress, such as checking whether it is
   * available: it reads as busy and shows a spinner at its end.
   */
  readonly busy?: boolean;
};

type ListRowProps = CommonProps &
  (
    | {
        /** Makes the row a button. */
        readonly onClick: () => void;
        readonly selected?: boolean;
        /**
         * Shows a check box for `selected` in place of the selection ring, as
         * in a list that takes several choices.
         */
        readonly check?: boolean;
        readonly disabled?: boolean;
        readonly option?: never;
        readonly link?: never;
      }
    | {
        /**
         * Makes the row an option of a listbox whose owner, such as a
         * combobox, keeps focus and marks the option its keys reached.
         */
        readonly option: ListRowOption;
        readonly onClick?: never;
        readonly selected?: never;
        readonly check?: never;
        readonly disabled?: never;
        readonly link?: never;
      }
    | {
        /**
         * Makes the row a link: `href` is where it leads, and `onClick`
         * handles the press, such as a router navigating in place.
         */
        readonly link: ListRowLink;
        readonly selected?: never;
        readonly onClick?: never;
        readonly check?: never;
        readonly disabled?: never;
        readonly option?: never;
      }
    | {
        readonly onClick?: never;
        readonly selected?: never;
        readonly check?: never;
        readonly disabled?: never;
        readonly option?: never;
        readonly link?: never;
      }
  );

type ListRowLink = {
  readonly href: string;
  readonly onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Opens the page in a new tab, such as another site's. */
  readonly newTab?: boolean;
};

type ListRowOption = {
  /** The option's id, for the owner's `aria-activedescendant`. */
  readonly id: string;
  readonly selected: boolean;
  /** The option the owner's keys reached; it shows the focus ring. */
  readonly active: boolean;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  /**
   * Shows a check box for `selected` in place of the selection ring, as in a
   * listbox that takes several choices.
   */
  readonly check?: boolean;
  /**
   * The title of the group the option is in, given as its description: a
   * virtualized listbox can't wrap its options in groups.
   */
  readonly groupLabel?: string | undefined;
  /**
   * Where the option sits in the whole list, of which only the rows in view
   * render. Leave `count` unset while more options may load.
   */
  readonly position?: { readonly index: number; readonly count?: number };
};

/**
 * One row of a list: a leading avatar, a title with badges over a subtitle
 * and status, and a trailing value over its subvalue in tabular figures, and
 * optional detail rows and a note under them. The value never wraps; the
 * title truncates. With `onClick` the row is a button; `selected` reads as
 * pressed. With `link` it is a link. With `option` it is an option of a
 * listbox. With `check` a check box shows the selection, for a choice of
 * several. Rings draw inside the row's edge, so a scrolling list never
 * clips them.
 */
export const ListRow = ({
  leading,
  title,
  subtitle,
  badges,
  status,
  density,
  variant,
  value,
  valueStruck = false,
  figure,
  subvalue,
  trailing,
  details,
  note,
  testId,
  busy = false,
  onClick,
  selected,
  check = false,
  disabled,
  option,
  link,
}: ListRowProps) => {
  const group = use(InListGroup);
  const condensed = (density ?? group?.density) === "condensed";
  const flat = condensed || variant === "flat";
  const groupLabelId = useId();
  const { copied, copy } = useCopy();
  const checked = option === undefined ? selected === true : option.selected;
  const showsCheckBox = option?.check ?? check;
  // A flat row marks its choice with a tint and a check; a card row draws
  // the selection ring.
  const ringsSelection = checked && !showsCheckBox && !flat;
  const checkBox = showsCheckBox && (
    <span
      aria-hidden="true"
      {...stylex.props(styles.check, checked && styles.checked)}
    >
      {checked && <Icon name="CheckIcon" size="sm" />}
    </span>
  );
  // A flat row that takes part in a choice keeps the check's slot whether
  // it is chosen or not, so the values of a picker's rows line up.
  const reservesCheck =
    flat && !showsCheckBox && (option !== undefined || selected !== undefined);
  const checksSelection = checked && reservesCheck;
  const checkMark = reservesCheck && (
    <span aria-hidden="true" {...stylex.props(styles.checkSlot)}>
      {checksSelection && <Icon name="CheckIcon" tone="accent" />}
    </span>
  );
  const valueText = value !== undefined && (
    <Text weight="medium" tone={valueStruck ? "muted" : "default"} numeric>
      {value}
    </Text>
  );
  const values = (value !== undefined || subvalue !== undefined) && (
    <Stack as="span" gap={2} align="end">
      {valueStruck ? (
        <span {...stylex.props(styles.struck)}>{valueText}</span>
      ) : (
        valueText
      )}
      {subvalue !== undefined && (
        <Text variant="caption" tone="muted" numeric>
          {subvalue}
        </Text>
      )}
    </Stack>
  );
  const trailingColumn = (figure !== undefined ||
    values ||
    trailing !== undefined) && (
    <span {...stylex.props(styles.trailing)}>
      {figure !== undefined && (
        <span
          {...stylex.props(
            styles.figure,
            figure.from === "sm" && styles.figureFromSm
          )}
        >
          <Text weight="medium" tone={figure.tone ?? "default"} numeric>
            {figure.text}
          </Text>
        </span>
      )}
      {values}
      {trailing}
    </span>
  );
  const secondLine = (subtitle !== undefined || status !== undefined) && (
    <span {...stylex.props(styles.secondLine)}>
      {subtitle !== undefined && (
        <Text variant="caption" tone="muted" truncate>
          {subtitle}
        </Text>
      )}
      {subtitle !== undefined && status !== undefined && (
        <span aria-hidden="true" {...stylex.props(styles.separator)}>
          <Text variant="caption" tone="muted">
            ·
          </Text>
        </span>
      )}
      {status !== undefined && (
        <span {...stylex.props(styles.status, toneTextStyles[status.tone])}>
          {status.icon !== undefined && <Icon name={status.icon} size="sm" />}
          <span
            {...stylex.props(
              styles.statusText,
              status.icon !== undefined && styles.statusTextFromSm
            )}
          >
            <Text variant="caption" weight="medium" truncate>
              {status.text}
            </Text>
          </span>
        </span>
      )}
    </span>
  );
  const main = (
    <>
      {checkBox}
      {leading !== undefined && (
        <span {...stylex.props(styles.leading)}>{leading}</span>
      )}
      <span
        {...stylex.props(
          styles.text,
          badges === undefined && !secondLine && styles.textTitleOnly
        )}
      >
        <span {...stylex.props(styles.title)}>
          <Text weight="medium" truncate>
            {title}
          </Text>
        </span>
        {badges !== undefined && (
          <span {...stylex.props(styles.badges)}>{badges}</span>
        )}
        {secondLine}
      </span>
      {trailingColumn}
      {checkMark}
      {busy && <Spinner size="sm" tone="muted" />}
    </>
  );
  // A listbox holds options only, so an option's copies are icons in it;
  // other rows' are buttons after them.
  const copies =
    option === undefined
      ? (details ?? []).flatMap((detail) =>
          detail.copy === undefined ? [] : [detail.copy]
        )
      : [];
  const hasDetails = details !== undefined && details.length > 0;
  const content =
    !hasDetails && note === undefined ? (
      main
    ) : (
      <Stack as="span" gap={8} grow>
        <span {...stylex.props(styles.main)}>{main}</span>
        {hasDetails && (
          <Stack as="span" gap={4}>
            {details.map((detail, index) => (
              <Stack
                key={detail.label}
                as="span"
                direction="row"
                justify="between"
                gap={16}
              >
                <Text variant="caption" tone="muted">
                  {detail.label}
                </Text>
                <Stack as="span" direction="row" align="center" gap={4}>
                  <Text variant="caption" numeric>
                    {detail.value}
                  </Text>
                  {option !== undefined && detail.copy !== undefined && (
                    // The option's press copies when it lands here.
                    <span
                      aria-hidden="true"
                      title={detail.copy.label}
                      data-copy={index}
                      {...stylex.props(styles.optionCopy)}
                    >
                      <Icon
                        name={copied ? "CheckIcon" : "CopyIcon"}
                        size="sm"
                      />
                    </span>
                  )}
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
        {note !== undefined && (
          <Text variant="caption" tone={note.tone}>
            {note.text}
          </Text>
        )}
      </Stack>
    );
  const surface = [
    styles.root,
    flat && styles.flat,
    condensed && styles.condensed,
  ];
  const pressable = [
    surface,
    interactiveStyles.root,
    styles.interactive,
    flat && styles.flatInteractive,
    checksSelection && styles.flatSelected,
    interactiveStyles.inset,
    ringsSelection && interactiveStyles.insetSelected,
    !flat && !ringsSelection && styles.interactiveEdge,
  ];
  const row = (() => {
    if (option !== undefined) {
      const select = option.disabled === true ? undefined : option.onSelect;
      const { groupLabel, position } = option;
      return (
        // Focus stays on the owner; tabIndex -1 keeps the option out of the
        // tab order, and pressing it doesn't pull focus from the owner.
        <div
          role="option"
          id={option.id}
          tabIndex={-1}
          aria-selected={option.selected}
          data-testid={testId}
          aria-disabled={option.disabled === true || undefined}
          aria-describedby={groupLabel === undefined ? undefined : groupLabelId}
          aria-posinset={
            position === undefined ? undefined : position.index + 1
          }
          aria-setsize={
            position === undefined ? undefined : (position.count ?? -1)
          }
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            const copyValue = pressedCopyValue(event.target, details);
            if (copyValue === undefined) select?.();
            else copy(copyValue);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              select?.();
            }
          }}
          {...stylex.props(
            pressable,
            option.active && styles.active,
            // The tint stays on the choice the keys reach.
            option.active && checksSelection && styles.flatSelected,
            option.disabled === true && styles.optionDisabled,
            option.disabled === true && flat && styles.flatDisabled
          )}
        >
          {content}
          {groupLabel !== undefined && (
            // A hidden element still describes the option that refers to it.
            <span id={groupLabelId} hidden>
              {groupLabel}
            </span>
          )}
        </div>
      );
    }
    if (link !== undefined) {
      return (
        <a
          href={link.href}
          onClick={link.onClick}
          {...(link.newTab === true
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          data-testid={testId}
          aria-busy={busy || undefined}
          {...stylex.props(pressable, styles.link)}
        >
          {content}
        </a>
      );
    }
    if (onClick === undefined) {
      return (
        <div
          data-testid={testId}
          aria-busy={busy || undefined}
          {...stylex.props(surface)}
        >
          {content}
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        data-testid={testId}
        aria-busy={busy || undefined}
        aria-pressed={selected}
        {...stylex.props(pressable)}
      >
        {content}
      </button>
    );
  })();

  // A control may not nest in the row's own, so copy buttons follow it.
  const withCopies =
    copies.length === 0 ? (
      row
    ) : (
      <div {...stylex.props(styles.withCopies)}>
        <div {...stylex.props(styles.copiesRow)}>{row}</div>
        {copies.map((detailCopy) => (
          <CopyButton key={detailCopy.label} {...detailCopy} size="sm" />
        ))}
      </div>
    );

  return group === undefined ? withCopies : <li>{withCopies}</li>;
};

/** The value of the detail copy icon a press on an option landed on. */
const pressedCopyValue = (
  target: EventTarget,
  details: ReadonlyArray<ListRowDetail> | undefined
) => {
  if (!(target instanceof Element)) return undefined;
  const index = target.closest("[data-copy]")?.getAttribute("data-copy");
  return index == null ? undefined : details?.[Number(index)]?.copy?.value;
};

/**
 * Rows read as one list, under an optional overline heading. `density` is
 * its rows'; condensed rows sit closer together, and, being flat, reach past
 * the content edge by their own inline padding, so their content lines up
 * with the heading and a dialog's title while their tint reaches past them.
 */
export const ListGroup = ({
  label,
  density = "comfortable",
  children,
}: {
  readonly label?: string;
  readonly density?: ListRowDensity;
  readonly children: ReactNode;
}) => {
  const labelId = useId();
  const condensed = density === "condensed";

  return (
    <InListGroup value={{ density }}>
      <Stack gap={8}>
        {label !== undefined && (
          <Text variant="overline" tone="muted" id={labelId}>
            {label}
          </Text>
        )}
        <div {...stylex.props(condensed && styles.flatGroup)}>
          <Stack
            as="ul"
            gap={condensed ? 2 : 8}
            aria-labelledby={label === undefined ? undefined : labelId}
          >
            {children}
          </Stack>
        </div>
      </Stack>
    </InListGroup>
  );
};

const styles = stylex.create({
  // Past the content edge by a row's inline padding, as a select sheet's
  // list reaches.
  flatGroup: { marginInline: `calc(-1 * ${space[12]})` },
  root: {
    margin: 0,
    borderColor: "transparent",
    borderRadius: radius.control,
    borderStyle: "none",
    gap: space[12],
    paddingBlock: space[12],
    paddingInline: space[12],
    alignItems: "center",
    // Under the `elevated` surface style a filled row lifts off the canvas as
    // a filled card does.
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
    boxSizing: "border-box",
    color: color.text,
    display: "flex",
    // Under the `outlined` surface style a filled row edges in `border`, as a
    // filled card does: an outline just inside its edge, so its height holds.
    // A pressable row draws it in `interactiveEdge` instead, as its focus
    // ring takes the outline.
    outlineColor: color.border,
    outlineOffset: insetEdge.offset,
    outlineStyle: {
      default: null,
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"]',
        presentationMarker
      )]: "solid",
    },
    outlineWidth: borderWidth.thin,
    minWidth: 0,
  },
  // The hover rule's `:not(:disabled)` outranks the ancestor condition, as on
  // a pressable card.
  interactive: {
    backgroundColor: {
      default: color.surface,
      ":hover:not(:disabled)": color.surfaceHover,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: color.surfaceRaised,
    },
    display: "flex",
  },
  // A filled pressable row's `outlined` edge, drawn as an inset shadow: the
  // outline is its focus ring's, which an edge on the same outline would
  // outrank under the surface style's condition. Under `elevated` it keeps
  // the row's lift.
  interactiveEdge: {
    boxShadow: {
      default: null,
      [stylex.when.ancestor(
        '[data-sk-surface-style="elevated"]',
        presentationMarker
      )]: elevation.raised,
      [stylex.when.ancestor(
        '[data-sk-surface-style="outlined"]',
        presentationMarker
        // ast-grep-ignore: no-raw-design-value -- composed only of the thin border width and the `border` role, drawn inset so it never meets the focus outline.
      )]: `inset 0 0 0 ${borderWidth.thin} ${color.border}`,
    },
  },
  main: {
    gap: space[12],
    alignItems: "center",
    display: "flex",
    minWidth: 0,
  },
  link: { textDecoration: "none" },
  flat: { backgroundColor: "transparent", boxShadow: "none" },
  condensed: {
    paddingBlock: space[8],
    minHeight: listRowHeight.condensed,
  },
  flatInteractive: {
    backgroundColor: {
      default: "transparent",
      ":hover:not(:disabled)": color.surfaceHover,
    },
  },
  flatDisabled: { backgroundColor: "transparent" },
  // Moves toward the hover surface, as an unselected row moves to it.
  flatSelected: {
    backgroundColor: {
      default: color.accentSoft,
      ":hover:not(:disabled)": `color-mix(in srgb, ${color.accentSoft}, ${color.surfaceHover})`,
    },
  },
  leading: { display: "flex", flexShrink: 0 },
  // The title and badges over the second line. Below `sm` the badges trail
  // the second line, so the title has the whole first line; from `sm` they
  // follow the title, which truncates before they move.
  text: {
    gridTemplateAreas: {
      default: '"title title" "second badges"',
      [container.sm]: '"title badges" "second second"',
    },
    alignItems: "center",
    columnGap: space[8],
    display: "grid",
    flexGrow: 1,
    gridTemplateColumns: {
      default: "minmax(0, 1fr) auto",
      [container.sm]: "minmax(0, max-content) minmax(max-content, 1fr)",
    },
    rowGap: space[2],
    minWidth: 0,
  },
  textTitleOnly: {
    gridTemplateAreas: '"title"',
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  // Each part takes its named area of `text`.
  title: {
    gridColumnEnd: "title",
    gridColumnStart: "title",
    gridRowEnd: "title",
    gridRowStart: "title",
    minWidth: 0,
  },
  badges: {
    gap: space[4],
    alignItems: "center",
    display: "flex",
    gridColumnEnd: "badges",
    gridColumnStart: "badges",
    gridRowEnd: "badges",
    gridRowStart: "badges",
    justifySelf: { default: "end", [container.sm]: "start" },
    whiteSpace: "nowrap",
  },
  // Sized as if empty across, the second line asks the grid for no width of
  // its own: it spans what the title and badges leave, and a long status
  // truncates there rather than widening its columns over the title.
  secondLine: {
    gap: space[4],
    alignItems: "center",
    contain: "inline-size",
    display: "flex",
    gridColumnEnd: "second",
    gridColumnStart: "second",
    gridRowEnd: "second",
    gridRowStart: "second",
    minWidth: 0,
  },
  separator: { display: "flex", flexShrink: 0 },
  // The state gives way before the subtitle: it starts from no width and
  // takes only the room the subtitle leaves, so its text truncates first,
  // down to its icon, and the subtitle keeps its text whole until the line
  // cannot hold it.
  status: {
    gap: space[2],
    alignItems: "center",
    display: "inline-flex",
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    whiteSpace: "nowrap",
    minWidth: iconSize.sm,
  },
  statusText: { display: "flex", minWidth: 0 },
  // Below `sm` a state with an icon shows the icon alone; its text stays for
  // assistive technology, as `VisuallyHidden` keeps it.
  statusTextFromSm: {
    margin: { default: visuallyHiddenBox.margin, [container.sm]: 0 },
    overflow: "hidden",
    clipPath: { default: "inset(50%)", [container.sm]: "none" },
    position: { default: "absolute", [container.sm]: "static" },
    height: { default: visuallyHiddenBox.size, [container.sm]: "auto" },
    width: { default: visuallyHiddenBox.size, [container.sm]: "auto" },
  },
  // Values and figures never wrap or shrink: the title truncates first.
  trailing: {
    gap: space[16],
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  figure: { display: "flex", flexShrink: 0 },
  figureFromSm: { display: { default: "none", [container.sm]: "flex" } },
  // As wide as the check, whether it shows or not.
  checkSlot: {
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    width: iconSize.md,
  },
  struck: { textDecorationLine: "line-through" },
  check: {
    borderColor: color.textMuted,
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thick,
    alignItems: "center",
    boxSizing: "border-box",
    color: color.onAccent,
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    height: selectionControlSize.checkbox,
    width: selectionControlSize.checkbox,
  },
  checked: { borderColor: color.accent, backgroundColor: color.accent },
  withCopies: {
    gap: space[4],
    alignItems: "center",
    display: "flex",
    minWidth: 0,
  },
  copiesRow: { flexGrow: 1, minWidth: 0 },
  optionCopy: {
    alignItems: "center",
    color: { default: color.textMuted, ":hover": color.text },
    cursor: "copy",
    display: "inline-flex",
    flexShrink: 0,
  },
  // The focus ring marks the option the owner's keys reached, as focus would.
  active: {
    backgroundColor: color.surfaceHover,
    outlineColor: color.focusRing,
    outlineOffset: focusRing.insetOffset,
    outlineStyle: focusRing.insetStyle,
    outlineWidth: focusRing.insetWidth,
  },
  optionDisabled: {
    backgroundColor: color.surface,
    color: color.textMuted,
    cursor: "not-allowed",
    // A div never matches `:disabled`, so the press scale is undone here.
    transform: "none",
  },
});
