import type BigNumber from "bignumber.js";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import type { ValidatorInput as ValidatorDto } from "../../../../domain/earn/validator";
import type { Token } from "../../../../domain/token/token";
import {
  amountSeparators,
  fromAmountValue,
  toAmountValue,
} from "../../../../shared/lib/amount-value";
import {
  formatNumber,
  formatTokenAmount,
} from "../../../../shared/lib/number-format";
import { useTokenLogo } from "../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import {
  AmountPanel,
  type AmountPanelNote,
  Button,
  Stack,
  Text,
  TokenTrigger,
} from "../../../../ui/index";
import { useWidgetConfig } from "../../../widget-configuration/index";
import { useYieldMetaInfo } from "../../../yield-summary/views";

type AmountBlockProps = {
  onAmountChange: (amount: BigNumber) => void;
  value: BigNumber;
  canChangeAmount: boolean;
  disabled?: boolean;
  onClick: () => void;
  exitAmountError?: boolean | undefined;
  onMaxClick: (() => void) | null;
  label: string;
  /** The amount's formatted fiat value, such as "$1,204.50". */
  fiatValue: string;
  /** The fiat value is still loading, such as while prices load. */
  fiatValueLoading?: boolean;
  balance: { amount: BigNumber; token: Token } | null;
  /** Muted lines under the amount, such as its estimated network fee. */
  notes?: ReadonlyArray<AmountPanelNote>;
} & (
  | {
      variant: "exit";
      exitToken: Token;
      canExit: boolean;
      exitIsGreaterOrLessIntegrationLimitError: boolean;
      /** The amount is more than the position holds. */
      exitAmountGreaterThanAvailable: boolean;
      exitMaxAmount: BigNumber | null;
      exitMinAmount: BigNumber | null;
      ctaPlacement?: "card" | "footer";
      /** Overrides the default position-token chip when CTA is in the footer. */
      tokenAccessory?: ReactNode;
    }
  | {
      variant: "action";
      /** The page leads with this action: its button fills. */
      primary: boolean;
    }
);

/** The position's token beside the amount, when there is none to choose. */
const ExitTokenTrigger = ({ token }: { readonly token: Token }) => {
  const logo = useTokenLogo(token);

  return <TokenTrigger token={{ ...logo, name: token.symbol }} readOnly />;
};

/** An amount to exit a position with, or to run a pending action on. */
export const AmountBlock = ({
  onAmountChange,
  value,
  canChangeAmount,
  disabled,
  onClick,
  label,
  fiatValue,
  fiatValueLoading = false,
  onMaxClick,
  balance,
  notes = [],
  exitAmountError,
  ...rest
}: AmountBlockProps) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const disableResizingInputFontSize = useWidgetConfig(
    "disableResizingInputFontSize"
  );

  const exitProps = rest.variant === "exit" ? rest : null;
  const min =
    exitProps?.exitMinAmount == null
      ? null
      : `${t("shared.min")} ${formatTokenAmount(
          exitProps.exitMinAmount,
          locale,
          "up"
        )} ${exitProps.exitToken.symbol}`;
  const max =
    exitProps?.exitMaxAmount == null
      ? null
      : `${t("shared.max")} ${formatTokenAmount(
          exitProps.exitMaxAmount,
          locale,
          "down"
        )} ${exitProps.exitToken.symbol}`;
  const limits = min && max ? `${min} / ${max}` : (min ?? max);
  // A missed limit says which one under the amount; the limits beside the
  // token stay the muted helper.
  const limitError = (() => {
    if (!exitProps?.exitIsGreaterOrLessIntegrationLimitError) return null;
    const { exitMaxAmount, exitMinAmount, exitToken } = exitProps;
    if (exitMaxAmount && value.isGreaterThan(exitMaxAmount)) {
      return t("position_details.amount_above_maximum", {
        amount: formatTokenAmount(exitMaxAmount, locale, "down"),
        symbol: exitToken.symbol,
      });
    }
    return exitMinAmount
      ? t("details.amount_error.below_minimum", {
          amount: formatTokenAmount(exitMinAmount, locale, "up"),
          symbol: exitToken.symbol,
        })
      : null;
  })();

  const showCardCta =
    rest.variant === "action" || rest.ctaPlacement !== "footer";
  const showAmount = rest.variant === "action" || rest.canExit;

  if (!showAmount) return null;

  const accessory = showCardCta ? (
    <Button
      onClick={onClick}
      disabled={disabled ?? false}
      size="sm"
      variant={
        rest.variant === "exit" || rest.primary ? "primary" : "secondary"
      }
    >
      {label}
    </Button>
  ) : (
    (rest.tokenAccessory ?? <ExitTokenTrigger token={rest.exitToken} />)
  );

  const balanceProps = balance
    ? {
        balance: {
          short: t("position_details.available", {
            amount: formatTokenAmount(balance.amount, locale, "down"),
            symbol: balance.token.symbol,
          }),
          full: t("position_details.available", {
            amount: formatNumber(balance.amount, locale),
            symbol: balance.token.symbol,
          }),
        },
      }
    : {};
  const error = exitProps?.exitAmountGreaterThanAvailable
    ? t("shared.insufficient_balance")
    : limitError;
  const limitProps = {
    ...(limits ? { limits } : {}),
    ...(error === null ? {} : { error }),
  };

  // The card names what it holds, the amount; its button or the page's
  // call to action names the verb.
  return (
    <AmountPanel
      shrink={!disableResizingInputFontSize}
      label={t("shared.amount")}
      value={toAmountValue(value)}
      onValueChange={(next) => onAmountChange(fromAmountValue(next))}
      separators={amountSeparators(locale)}
      disabled={!canChangeAmount}
      invalid={exitAmountError ?? false}
      token={accessory}
      fiatValue={fiatValue}
      fiatValueLoading={fiatValueLoading}
      {...balanceProps}
      {...limitProps}
      {...(canChangeAmount && onMaxClick
        ? {
            max: {
              label: t("shared.max"),
              onClick: onMaxClick,
              disabled: balance?.amount.isZero() ?? false,
            },
          }
        : {})}
      notes={notes}
    />
  );
};

export const ExitInfo = ({
  hideWithdrawnTime = false,
  validators,
  yieldDto,
  exitToken,
}: {
  hideWithdrawnTime?: boolean;
  yieldDto: EarnYieldWithProvider;
  validators: {
    [Key in keyof Pick<ValidatorDto, "name" | "address">]?: ValidatorDto[Key];
  }[];
  exitToken: Token;
}) => {
  const { withdrawnTime, withdrawnNotAvailable, positionLocked } =
    useYieldMetaInfo({
      validators,
      selectedStake: yieldDto,
      tokenDto: exitToken,
    });

  const values = [
    hideWithdrawnTime ? null : withdrawnTime,
    withdrawnNotAvailable,
    positionLocked,
  ].filter((value) => !!value);

  return values.length > 0 ? (
    <Stack gap={8}>
      {values.map((value, i) => (
        <Text key={i} variant="caption" tone="muted" icon="InfoIcon">
          {value}
        </Text>
      ))}
    </Stack>
  ) : null;
};
