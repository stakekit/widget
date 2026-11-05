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
import { borderWidth, focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { container } from "../tokens/container.stylex";
import { radius } from "../tokens/radius.stylex";
import { selectionControlSize } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { CopyButton } from "./copy-button";
import { interactiveStyles } from "./interactive-styles";
import { Spinner } from "./spinner";
import { toneTextStyles } from "./tone-styles";
import { useCopy } from "./use-copy";

/**
 * `condensed` is for pickers, such as of a network, an account or a wallet: a
 * shorter row with no surface of its own that tints on hover, and a trailing
 * check for `selected` in place of the selection ring. Its avatar takes the
 * `control` size.
 */
type ListRowDensity = "comfortable" | "condensed";

/** Set inside a `ListGroup`: its rows' density. */
const InListGroup = createContext<
  { readonly density: ListRowDensity } | undefined
>(undefined);

/** A state on a row's second line, such as "Action required". */
type ListRowStatus = {
  readonly text: string;
  readonly tone: "success" | "warning" | "danger" | "info";
  /** A small leading icon, such as `WarningIcon`. */
  readonly icon?: FixedIconName;
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
  readonly leading?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  /**
   * Badges beside the title; below the `sm` container size they move to the
   * second line, so the title keeps its room.
   */
  readonly badges?: ReactNode;
  /**
   * A state after the subtitle on the second line, as colored text with an
   * optional icon rather than a chip, such as "⚠ Action required".
   */
  readonly status?: ListRowStatus;
  /** Unset, the row takes its `ListGroup`'s density, else `comfortable`. */
  readonly density?: ListRowDensity;
  /**
   * The trailing figure, such as a formatted balance. It never wraps: the
   * title truncates first.
   */
  readonly value?: string;
  /**
   * A figure before the value column, such as a reward rate. `success` is
   * for positive rates and claimable amounts only. With `from` it shows only
   * from that container size up, so a narrow row keeps room for its title.
   */
  readonly figure?: {
    readonly text: string;
    readonly tone?: "default" | "success";
    readonly from?: "sm";
  };
  /** Context under the value, such as its fiat equivalent. */
  readonly subvalue?: string;
  /**
   * Label-value rows under the row's main line, such as a validator's
   * commission and staked balance. A detail with `copy` copies its value
   * without pressing the row: a copy button follows the row, outside its own
   * control, or, as a listbox holds options only, a pointer's press on a copy
   * icon beside the detail copies in place of choosing the option.
   */
  readonly details?: ReadonlyArray<ListRowDetail>;
  /** Renders as the row's `data-testid`. */
  readonly testId?: string;
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
        readonly onClick?: never;
        readonly selected?: never;
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
  readonly groupLabel?: string;
  /**
   * Where the option sits in the whole list, of which only the rows in view
   * render. Leave `count` unset while more options may load.
   */
  readonly position?: { readonly index: number; readonly count?: number };
};

/**
 * One row of a list: a leading avatar, a title with badges over a subtitle
 * and status, and a trailing value over its subvalue in tabular figures, and
 * optional detail rows under them. The value never wraps; the title
 * truncates. With `onClick` the row is a button; `selected` reads as
 * pressed. With `link` it is a link. With `option` it is an option of a
 * listbox. With `check` a check box shows the selection, for a choice of
 * several. Rings draw inside the row's edge, so a scrolling list never clips
 * them.
 */
export const ListRow = ({
  leading,
  title,
  subtitle,
  badges,
  status,
  density,
  value,
  figure,
  subvalue,
  details,
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
  const groupLabelId = useId();
  const { copied, copy } = useCopy();
  const checked = option === undefined ? selected === true : option.selected;
  const showsCheckBox = option?.check ?? check;
  // A condensed row marks its choice with a check after its values; others
  // draw the selection ring.
  const ringsSelection = checked && !showsCheckBox && !condensed;
  const checkBox = showsCheckBox && (
    <span
      aria-hidden="true"
      {...stylex.props(styles.check, checked && styles.checked)}
    >
      {checked && <Icon name="CheckIcon" size="sm" />}
    </span>
  );
  const checkMark = checked && !showsCheckBox && condensed && (
    <Icon name="CheckIcon" tone="accent" />
  );
  const values = (value !== undefined || subvalue !== undefined) && (
    <Stack as="span" gap={2} align="end">
      {value !== undefined && (
        <Text weight="medium" numeric>
          {value}
        </Text>
      )}
      {subvalue !== undefined && (
        <Text variant="caption" tone="muted" numeric>
          {subvalue}
        </Text>
      )}
    </Stack>
  );
  const trailing = (figure !== undefined || values) && (
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
          <Text variant="caption" weight="medium">
            {status.text}
          </Text>
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
      {trailing}
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
  const content =
    details === undefined || details.length === 0 ? (
      main
    ) : (
      <Stack as="span" gap={8} grow>
        <span {...stylex.props(styles.main)}>{main}</span>
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
                    <Icon name={copied ? "CheckIcon" : "CopyIcon"} size="sm" />
                  </span>
                )}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Stack>
    );
  const surface = [styles.root, condensed && styles.condensed];
  const pressable = [
    surface,
    interactiveStyles.root,
    styles.interactive,
    condensed && styles.condensedInteractive,
    ringsSelection && interactiveStyles.selected,
    interactiveStyles.inset,
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
            option.disabled === true && styles.optionDisabled,
            option.disabled === true && condensed && styles.condensedDisabled
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
 * its rows'; condensed rows sit closer together.
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

  return (
    <InListGroup value={{ density }}>
      <Stack gap={8}>
        {label !== undefined && (
          <Text variant="overline" tone="muted" id={labelId}>
            {label}
          </Text>
        )}
        <Stack
          as="ul"
          gap={density === "condensed" ? 2 : 8}
          aria-labelledby={label === undefined ? undefined : labelId}
        >
          {children}
        </Stack>
      </Stack>
    </InListGroup>
  );
};

const styles = stylex.create({
  root: {
    margin: 0,
    borderColor: "transparent",
    borderRadius: radius.control,
    borderStyle: "none",
    gap: space[12],
    paddingBlock: space[12],
    paddingInline: space[12],
    alignItems: "center",
    backgroundColor: color.surface,
    boxSizing: "border-box",
    color: color.text,
    display: "flex",
    minWidth: 0,
  },
  interactive: {
    backgroundColor: {
      default: color.surface,
      ":hover:not(:disabled)": color.surfaceHover,
    },
    display: "flex",
  },
  main: {
    gap: space[12],
    alignItems: "center",
    display: "flex",
    minWidth: 0,
  },
  link: { textDecoration: "none" },
  condensed: {
    paddingBlock: space[8],
    backgroundColor: "transparent",
  },
  condensedInteractive: {
    backgroundColor: {
      default: "transparent",
      ":hover:not(:disabled)": color.surfaceHover,
    },
  },
  condensedDisabled: { backgroundColor: "transparent" },
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
  secondLine: {
    gap: space[4],
    alignItems: "center",
    display: "flex",
    gridColumnEnd: "second",
    gridColumnStart: "second",
    gridRowEnd: "second",
    gridRowStart: "second",
    minWidth: 0,
  },
  separator: { display: "flex", flexShrink: 0 },
  status: {
    gap: space[2],
    alignItems: "center",
    display: "inline-flex",
    flexShrink: 0,
    whiteSpace: "nowrap",
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
    outlineStyle: "solid",
    outlineWidth: focusRing.width,
  },
  optionDisabled: {
    backgroundColor: color.surface,
    color: color.textMuted,
    cursor: "not-allowed",
    // A div never matches `:disabled`, so the press scale is undone here.
    transform: "none",
  },
});
