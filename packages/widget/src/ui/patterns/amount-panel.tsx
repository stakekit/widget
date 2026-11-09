import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { AmountInput } from "../components/amount-input";
import type { AmountSeparators } from "../components/amount-input-text";
import { Card } from "../components/card";
import { Chip } from "../components/chip";
import { ExpandableAmount } from "../components/expandable-amount";
import { Field } from "../components/field";
import { hitAreaStyles } from "../components/hit-area";
import { Skeleton } from "../components/skeleton";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import { lineHeight } from "../tokens/typography.stylex";

/**
 * A muted line under the panel. `text` is null while what it says loads:
 * a placeholder holds the line's place so the layout below stays still.
 */
export type AmountPanelNote = Readonly<{
  /** Stable across the line's states, so it keeps its place. */
  readonly id: string;
  readonly text: string | null;
}>;

type AmountPanelProps = {
  /** Names the amount, such as "Stake". */
  readonly label: string;
  /**
   * Where the label shows: inside the panel over the amount, or above the
   * panel as the section's title. Either way it names the amount.
   */
  readonly labelPlacement?: "inside" | "above";
  /**
   * The title above the panel is still resolving, such as while a yield
   * loads: a placeholder holds its place so a fallback name never flashes.
   * The label still names the amount to assistive technology.
   */
  readonly labelPending?: boolean;
  /** The amount as a decimal string, or `""` for none. */
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** The Widget language's separators. */
  readonly separators: AmountSeparators;
  /**
   * The token beside the amount: a `TokenTrigger`, or a `SelectSheet` whose
   * trigger is one.
   */
  readonly token: ReactNode;
  /**
   * The amount's formatted fiat value, such as "$1,204.50", or a zero value
   * for an empty amount. Its line stays even when empty, such as without a
   * price, so typing an amount never moves the panel.
   */
  readonly fiatValue: string;
  /**
   * The fiat value is still loading, such as while prices load: a
   * placeholder holds its place while the rest of the panel shows.
   */
  readonly fiatValueLoading?: boolean;
  /** The balance the amount draws on, at the foot beside the "Max" chip. */
  readonly balance?:
    | {
        /** The formatted balance, such as "12.5 ETH available". */
        readonly short: string;
        /**
         * The balance at full precision, such as "12.534217 ETH available";
         * set, a tap on the balance toggles between the two.
         */
        readonly full?: string;
        /**
         * Fills in the balance as the amount, as some hosts expect: a tap on
         * the balance calls `onClick` in place of the precision toggle, and
         * `label`, such as "Max", adds what it does to the balance's name.
         */
        readonly fill?: {
          readonly label: string;
          readonly onClick: () => void;
        };
        /**
         * A chip after the balance, such as "Reveal" for a confidential
         * balance still masked, or "Hide" once it shows.
         */
        readonly action?: {
          readonly label: string;
          readonly onClick: () => void;
          /** Such as while the balance is being revealed. */
          readonly disabled?: boolean;
        };
      }
    | undefined;
  /**
   * The formatted limits, such as "Min 0.01 ETH", at the end of the line
   * under the amount: the helper, which stays in view and in its own tone
   * beside any error. A missed limit is said by `error`.
   */
  readonly limits?: string;
  /**
   * Why the amount cannot be used, such as "Insufficient balance" or "Enter
   * at least 0.01 ETH", at the start of the line under the amount: it marks
   * the amount invalid, describes it, and edges the panel in the danger tone.
   */
  readonly error?: string;
  /**
   * Why no amount can be used yet, said before one is typed, such as "You
   * need at least 1 ETH to stake", in the error's place in the warning tone.
   * It describes the amount without marking it invalid; an error wins.
   */
  readonly warning?: string;
  /**
   * Marks the amount invalid without an `error` to show, such as an empty
   * amount after a submit; the panel edges in the danger tone.
   */
  readonly invalid?: boolean;
  /** The "Max" chip, which fills in the most the user can use. */
  readonly max?:
    | {
        readonly label: string;
        readonly onClick: () => void;
        readonly disabled?: boolean;
      }
    | undefined;
  /**
   * Muted lines under the panel about what using the amount costs, such as
   * "Network fee ≈ 0.0003 ETH ($0.52)" or what Max keeps aside for it.
   */
  readonly notes?: ReadonlyArray<AmountPanelNote>;
  readonly disabled?: boolean;
  readonly onBlur?: () => void;
  /** Steps the amount's type down as it fills the input. On by default. */
  readonly shrink?: boolean;
  /** Render as the `data-testid` of the panel, the amount and the "Max" chip. */
  readonly testIds?: {
    readonly root?: string | undefined;
    readonly input?: string | undefined;
    readonly max?: string | undefined;
  };
  /** Each new value above zero focuses the amount; zero never does. */
  readonly focusRequest?: number | undefined;
};

/**
 * Where a user enters an amount of a token: the labelled amount beside the
 * token; under it, one line with what is wrong at its start (an error, or a
 * warning before any amount is typed) and the limits as its helper at its
 * end; and at the foot its fiat value, the balance and a "Max" chip. Under
 * the panel, muted notes say what using the amount costs. While the amount
 * is invalid the panel edges in the danger tone; focus still edges it in the
 * accent.
 */
export const AmountPanel = ({
  label,
  labelPlacement = "inside",
  labelPending = false,
  value,
  onValueChange,
  separators,
  token,
  fiatValue,
  fiatValueLoading = false,
  balance,
  limits,
  error,
  warning,
  max,
  notes = [],
  invalid = false,
  disabled = false,
  onBlur,
  shrink = true,
  testIds,
  focusRequest = 0,
}: AmountPanelProps) => {
  const amountInvalid = invalid || error !== undefined;
  const panel = (
    <Card
      variant="field"
      padding={16}
      focusEdge
      invalid={amountInvalid}
      testId={testIds?.root}
    >
      <Stack gap={8}>
        <Field
          {...(labelPlacement === "inside" ? { label } : {})}
          disabled={disabled}
          description={limits}
          descriptionAtEnd={limits !== undefined}
          error={error}
          warning={warning}
        >
          <Stack direction="row" align="center" gap={12}>
            <AmountInput
              // Titled above, the amount names itself with the title's text.
              {...(labelPlacement === "above" ? { label } : {})}
              value={value}
              onValueChange={onValueChange}
              separators={separators}
              invalid={amountInvalid}
              disabled={disabled}
              shrink={shrink}
              focusRequest={focusRequest}
              onBlur={onBlur}
              testId={testIds?.input}
            />
            {token}
          </Stack>
        </Field>
        <Stack direction="row" align="center" justify="between" gap={8} wrap>
          <span
            aria-busy={fiatValueLoading || undefined}
            {...stylex.props(styles.fiatLine)}
          >
            {fiatValueLoading ? (
              <span {...stylex.props(styles.pendingFiat)}>
                <Skeleton shape="line" variant="caption" />
              </span>
            ) : (
              <Text variant="caption" tone="muted" numeric>
                {fiatValue}
              </Text>
            )}
          </span>
          {(balance !== undefined || max !== undefined) && (
            <Stack direction="row" align="center" gap={8}>
              {balance !== undefined && (
                <Text variant="caption" tone="muted" numeric>
                  <BalanceAmount balance={balance} disabled={disabled} />
                </Text>
              )}
              {balance?.action !== undefined && (
                <Chip
                  onClick={balance.action.onClick}
                  disabled={disabled || (balance.action.disabled ?? false)}
                >
                  {balance.action.label}
                </Chip>
              )}
              {max !== undefined && (
                <Chip
                  onClick={max.onClick}
                  testId={testIds?.max}
                  disabled={disabled || (max.disabled ?? false)}
                >
                  {max.label}
                </Chip>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );

  const notesBlock =
    notes.length > 0 ? (
      <Stack gap={4}>
        {notes.map((note) =>
          note.text === null ? (
            <span key={note.id} {...stylex.props(styles.pendingNote)}>
              <Skeleton shape="line" variant="caption" />
            </span>
          ) : (
            <Text key={note.id} variant="caption" tone="muted" numeric>
              {note.text}
            </Text>
          )
        )}
      </Stack>
    ) : null;

  if (labelPlacement === "inside" && notesBlock === null) return panel;

  // The title shows above the panel; the amount names itself with the same
  // text, so the title reads once, as the section's heading.
  return (
    <Stack gap={8}>
      {labelPlacement === "above" && (
        <span {...stylex.props(labelPending && styles.pendingTitle)}>
          {labelPending ? (
            <Skeleton shape="line" />
          ) : (
            <Text weight="medium">{label}</Text>
          )}
        </span>
      )}
      {panel}
      {notesBlock}
    </Stack>
  );
};

/** The balance's figure: filling it in, toggling its precision, or as is. */
const BalanceAmount = ({
  balance,
  disabled,
}: {
  readonly balance: NonNullable<AmountPanelProps["balance"]>;
  readonly disabled: boolean;
}) => {
  if (balance.fill !== undefined) {
    return (
      <button
        type="button"
        // The name starts with the text shown, then says what a tap does.
        aria-label={`${balance.short}, ${balance.fill.label}`}
        onClick={balance.fill.onClick}
        disabled={disabled}
        {...stylex.props(styles.fill, hitAreaStyles.coarse)}
      >
        {balance.short}
      </button>
    );
  }
  if (balance.full === undefined) return balance.short;
  return <ExpandableAmount short={balance.short} full={balance.full} />;
};

const styles = stylex.create({
  fiatLine: { display: "flex", minHeight: lineHeight.caption },
  pendingFiat: { display: "block", width: space[64] },
  // A placeholder note about as wide as a short fee line.
  pendingNote: {
    display: "block",
    width: `calc(${space[64]} * 2 + ${space[32]})`,
  },
  // A placeholder title about as wide as a short yield type name.
  pendingTitle: {
    display: "block",
    width: `calc(${space[64]} + ${space[32]})`,
  },
  // Reads as the balance text it is, as `ExpandableAmount` does.
  fill: {
    margin: 0,
    padding: 0,
    borderRadius: radius.badge,
    borderStyle: "none",
    backgroundColor: "transparent",
    color: "inherit",
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    fontFamily: "inherit",
    fontSize: "inherit",
    fontWeight: "inherit",
    lineHeight: "inherit",
    outlineColor: color.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
    textAlign: "inherit",
  },
});
