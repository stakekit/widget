import type { ReactNode } from "react";
import { AmountInput } from "../components/amount-input";
import type { AmountSeparators } from "../components/amount-input-text";
import { Card } from "../components/card";
import { Chip } from "../components/chip";
import { ExpandableAmount } from "../components/expandable-amount";
import { Field } from "../components/field";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";

type AmountPanelProps = {
  /** Names the amount, shown above it, such as "Stake". */
  readonly label: string;
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
  /** The amount's formatted fiat value, such as "$1,204.50". */
  readonly fiatValue: string;
  /** The balance the amount draws on, at the foot beside the "Max" chip. */
  readonly balance?: {
    /** The formatted balance, such as "12.5 ETH available". */
    readonly short: string;
    /**
     * The balance at full precision, such as "12.534217 ETH available"; set,
     * a tap on the balance toggles between the two.
     */
    readonly full?: string;
    /** `danger` when the amount is more than the balance. */
    readonly tone?: "danger";
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
  /** The formatted limits, such as "Min 0.01 ETH", under the amount. */
  readonly limits?: string;
  /**
   * Why the amount cannot be used, such as "Insufficient balance". It
   * replaces `limits`, marks the amount invalid and describes it.
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
};

/**
 * Where a user enters an amount of a token: the labelled amount beside the
 * token, its limits or error under it, and its fiat value, the balance and a
 * "Max" chip at the foot.
 */
export const AmountPanel = ({
  label,
  value,
  onValueChange,
  separators,
  token,
  fiatValue,
  balance,
  limits,
  error,
  max,
  invalid = false,
  disabled = false,
  onBlur,
  shrink = true,
  testIds,
}: AmountPanelProps) => (
  <Card
    padding={16}
    {...(testIds?.root === undefined ? {} : { testId: testIds.root })}
  >
    <Stack gap={8}>
      <Field
        label={label}
        disabled={disabled}
        {...(limits === undefined ? {} : { description: limits })}
        {...(error === undefined ? {} : { error })}
      >
        <Stack direction="row" align="center" gap={12}>
          <AmountInput
            value={value}
            onValueChange={onValueChange}
            separators={separators}
            invalid={invalid || error !== undefined}
            disabled={disabled}
            shrink={shrink}
            {...(onBlur === undefined ? {} : { onBlur })}
            {...(testIds?.input === undefined ? {} : { testId: testIds.input })}
          />
          {token}
        </Stack>
      </Field>
      <Stack direction="row" align="center" justify="between" gap={8} wrap>
        <Text variant="caption" tone="muted" numeric>
          {fiatValue}
        </Text>
        {(balance !== undefined || max !== undefined) && (
          <Stack direction="row" align="center" gap={8}>
            {balance !== undefined && (
              <Text variant="caption" tone={balance.tone ?? "muted"} numeric>
                {balance.full === undefined ? (
                  balance.short
                ) : (
                  <ExpandableAmount short={balance.short} full={balance.full} />
                )}
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
                {...(testIds?.max === undefined ? {} : { testId: testIds.max })}
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
