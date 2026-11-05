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
  Button,
  Icon,
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
  formattedAmount: string;
  balance: { amount: BigNumber; token: Token } | null;
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
  | { variant: "action" }
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
  formattedAmount,
  onMaxClick,
  balance,
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
  const limitError =
    exitProps?.exitIsGreaterOrLessIntegrationLimitError ?? false;

  const showCardCta =
    rest.variant === "action" || rest.ctaPlacement !== "footer";
  const showAmount = rest.variant === "action" || rest.canExit;

  if (!showAmount) return null;

  const accessory = showCardCta ? (
    <Button
      onClick={onClick}
      disabled={disabled ?? false}
      size="sm"
      variant={rest.variant === "exit" ? "primary" : "secondary"}
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
          ...(exitProps?.exitAmountGreaterThanAvailable
            ? { tone: "danger" as const }
            : {}),
        },
      }
    : {};
  const limitProps = (() => {
    if (limitError && limits) return { error: limits };
    if (exitProps?.exitAmountGreaterThanAvailable) {
      return { error: t("shared.insufficient_balance") };
    }
    return limits ? { limits } : {};
  })();

  return (
    <AmountPanel
      shrink={!disableResizingInputFontSize}
      label={label}
      value={toAmountValue(value)}
      onValueChange={(next) => onAmountChange(fromAmountValue(next))}
      separators={amountSeparators(locale)}
      disabled={!canChangeAmount}
      invalid={exitAmountError ?? false}
      token={accessory}
      fiatValue={formattedAmount}
      {...balanceProps}
      {...limitProps}
      {...(canChangeAmount && onMaxClick
        ? { max: { label: t("shared.max"), onClick: onMaxClick } }
        : {})}
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
        <Stack key={i} direction="row" align="center" gap={4}>
          <Icon name="InfoIcon" size="sm" tone="muted" />
          <Text variant="caption" tone="muted">
            {value}
          </Text>
        </Stack>
      ))}
    </Stack>
  ) : null;
};
