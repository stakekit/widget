import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { AmountInput } from "../components/amount-input";
import type { AmountSeparators } from "../components/amount-input-text";
import { Card } from "../components/card";
import { Chip } from "../components/chip";
import { ExpandableAmount } from "../components/expandable-amount";
import { Field } from "../components/field";
import { Skeleton } from "../components/skeleton";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import { lineHeight } from "../tokens/typography.stylex";

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
  readonly balance?: {
    /** The formatted balance, such as "12.5 ETH available". */
    readonly short: string;
    /**
     * The balance at full precision, such as "12.534217 ETH available"; set,
     * a tap on the balance toggles between the two.
     */
    readonly full?: string;
    /**
     * Fills in the balance as the amount, as some hosts expect: a tap on the
     * balance calls `onClick` in place of the precision toggle, and `label`,
     * such as "Max", adds what it does to the balance's name.
     */
    readonly fill?: {
      readonly label: string;
      readonly onClick: () => void;
    };
    /**
     * A chip after the balance, such as "Reveal" for a confidential balance
     * still masked, or "Hide" once it shows.
     */
    readonly action?: {
      readonly label: string;
      readonly onClick: () => void;
      /** Such as while the balance is being revealed. */
      readonly disabled?: boolean;
    };
  };
  /**
   * The formatted limits, such as "Min 0.01 ETH", at the end of the line
   * under the token, where they stay in view beside any error.
   */
  readonly limits?: string;
  /** The amount misses its limits: they turn to the danger tone. */
  readonly limitsMissed?: boolean;
  /**
   * Why the amount cannot be used, such as "Insufficient balance", under the
   * amount: it marks the amount invalid and describes it.
   */
  readonly error?: string;
  /**
   * Marks the amount invalid without an `error` to show, such as an empty
   * amount after a submit.
   */
  readonly invalid?: boolean;
  /** The "Max" chip, which fills in the most the user can use. */
  readonly max?: {
    readonly label: string;
    readonly onClick: () => void;
    readonly disabled?: boolean;
  };
  readonly disabled?: boolean;
  readonly onBlur?: () => void;
  /** Steps the amount's type down as it fills the input. On by default. */
  readonly shrink?: boolean;
  /** Render as the `data-testid` of the panel, the amount and the "Max" chip. */
  readonly testIds?: {
    readonly root?: string;
    readonly input?: string;
    readonly max?: string;
  };
  /** Each new value above zero focuses the amount; zero never does. */
  readonly focusRequest?: number;
};

/**
 * Where a user enters an amount of a token: the labelled amount beside the
 * token, its limits or error under it, and its fiat value, the balance and a
 * "Max" chip at the foot.
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
  limitsMissed = false,
  error,
  max,
  invalid = false,
  disabled = false,
  onBlur,
  shrink = true,
  testIds,
  focusRequest = 0,
}: AmountPanelProps) => {
  const panel = (
    <Card
      variant="field"
      padding={16}
      focusEdge
      {...(testIds?.root === undefined ? {} : { testId: testIds.root })}
    >
      <Stack gap={8}>
        <Field
          {...(labelPlacement === "inside" ? { label } : {})}
          disabled={disabled}
          {...(limits === undefined
            ? {}
            : {
                description: limits,
                descriptionAtEnd: true,
                descriptionInvalid: limitsMissed,
              })}
          {...(error === undefined ? {} : { error })}
        >
          <Stack direction="row" align="center" gap={12}>
            <AmountInput
              // Titled above, the amount names itself with the title's text.
              {...(labelPlacement === "above" ? { label } : {})}
              value={value}
              onValueChange={onValueChange}
              separators={separators}
              invalid={invalid || limitsMissed || error !== undefined}
              disabled={disabled}
              shrink={shrink}
              focusRequest={focusRequest}
              {...(onBlur === undefined ? {} : { onBlur })}
              {...(testIds?.input === undefined
                ? {}
                : { testId: testIds.input })}
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
                <Skeleton shape="line" role="caption" />
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
                  {...(testIds?.max === undefined
                    ? {}
                    : { testId: testIds.max })}
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

  if (labelPlacement === "inside") return panel;

  // The title shows above the panel; the amount names itself with the same
  // text, so the title reads once, as the section's heading.
  return (
    <Stack gap={8}>
      <span {...stylex.props(labelPending && styles.pendingTitle)}>
        {labelPending ? (
          <Skeleton shape="line" />
        ) : (
          <Text weight="medium">{label}</Text>
        )}
      </span>
      {panel}
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
        {...stylex.props(styles.fill)}
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
