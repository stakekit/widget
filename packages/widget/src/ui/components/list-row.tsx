import * as stylex from "@stylexjs/stylex";
import {
  createContext,
  type MouseEvent,
  type ReactNode,
  use,
  useId,
} from "react";
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
import { useCopy } from "./use-copy";

const InListGroup = createContext(false);

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
  /** Badges beside the title. */
  readonly badges?: ReactNode;
  /** The trailing figure, such as a formatted balance. */
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
 * One row of a list: a leading avatar, a title and subtitle with badges, and
 * a trailing value over its subvalue in tabular figures, and optional
 * detail rows under them. With `onClick` the row is a button; `selected`
 * reads as pressed. With `link` it is a link. With `option` it is an option
 * of a listbox. With `check` a check box shows the selection, for a choice
 * of several.
 */
export const ListRow = ({
  leading,
  title,
  subtitle,
  badges,
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
  const grouped = use(InListGroup);
  const groupLabelId = useId();
  const { copied, copy } = useCopy();
  const checked = option === undefined ? selected === true : option.selected;
  const checkBox = (option?.check ?? check) && (
    <span
      aria-hidden="true"
      {...stylex.props(styles.check, checked && styles.checked)}
    >
      {checked && <Icon name="CheckIcon" size="sm" />}
    </span>
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
  const trailing =
    figure === undefined ? (
      values
    ) : (
      <Stack as="span" direction="row" align="center" gap={16}>
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
        {values}
      </Stack>
    );
  const main = (
    <>
      {checkBox}
      {leading !== undefined && (
        <span {...stylex.props(styles.leading)}>{leading}</span>
      )}
      <Stack as="span" gap={2} grow>
        <Stack as="span" direction="row" align="center" gap={8}>
          <Text weight="medium" truncate>
            {title}
          </Text>
          {badges}
        </Stack>
        {subtitle !== undefined && (
          <Text variant="caption" tone="muted" truncate>
            {subtitle}
          </Text>
        )}
      </Stack>
      {trailing}
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
            styles.root,
            interactiveStyles.root,
            styles.interactive,
            option.selected &&
              option.check !== true &&
              interactiveStyles.selected,
            option.active && styles.active,
            option.disabled === true && styles.optionDisabled
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
          {...stylex.props(
            styles.root,
            interactiveStyles.root,
            styles.interactive,
            styles.link
          )}
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
          {...stylex.props(styles.root)}
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
        {...stylex.props(
          styles.root,
          interactiveStyles.root,
          styles.interactive,
          selected === true && !check && interactiveStyles.selected
        )}
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

  return grouped ? <li>{withCopies}</li> : withCopies;
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

/** Rows read as one list, under an optional overline heading. */
export const ListGroup = ({
  label,
  children,
}: {
  readonly label?: string;
  readonly children: ReactNode;
}) => {
  const labelId = useId();

  return (
    <InListGroup value>
      <Stack gap={8}>
        {label !== undefined && (
          <Text variant="overline" tone="muted" id={labelId}>
            {label}
          </Text>
        )}
        <Stack
          as="ul"
          gap={8}
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
  leading: { display: "flex", flexShrink: 0 },
  figure: { display: "flex", flexShrink: 0, whiteSpace: "nowrap" },
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
    outlineOffset: focusRing.offset,
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
