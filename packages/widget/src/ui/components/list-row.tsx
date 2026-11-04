import * as stylex from "@stylexjs/stylex";
import { createContext, type ReactNode, use, useId } from "react";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import { interactiveStyles } from "./interactive-styles";

const InListGroup = createContext(false);

type CommonProps = {
  /** An avatar: `TokenAvatar`, `Avatar` or an icon. */
  readonly leading?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  /** Badges beside the title. */
  readonly badges?: ReactNode;
  /** The trailing figure, such as a formatted balance. */
  readonly value?: string;
  /** Context under the value, such as its fiat equivalent. */
  readonly subvalue?: string;
};

type ListRowProps = CommonProps &
  (
    | {
        /** Makes the row a button. */
        readonly onClick: () => void;
        readonly selected?: boolean;
        readonly disabled?: boolean;
      }
    | {
        readonly onClick?: never;
        readonly selected?: never;
        readonly disabled?: never;
      }
  );

/**
 * One row of a list: a leading avatar, a title and subtitle with badges, and
 * a trailing value over its subvalue in tabular figures. With `onClick` the
 * row is a button; `selected` reads as pressed.
 */
export const ListRow = ({
  leading,
  title,
  subtitle,
  badges,
  value,
  subvalue,
  onClick,
  selected,
  disabled,
}: ListRowProps) => {
  const grouped = use(InListGroup);
  const content = (
    <>
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
      {(value !== undefined || subvalue !== undefined) && (
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
      )}
    </>
  );
  const row =
    onClick === undefined ? (
      <div {...stylex.props(styles.root)}>{content}</div>
    ) : (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        {...stylex.props(
          styles.root,
          interactiveStyles.root,
          styles.interactive,
          selected && interactiveStyles.selected
        )}
      >
        {content}
      </button>
    );

  return grouped ? <li>{row}</li> : row;
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
  leading: { display: "flex", flexShrink: 0 },
});
