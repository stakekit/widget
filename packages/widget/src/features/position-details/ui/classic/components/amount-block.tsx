import BigNumber from "bignumber.js";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../app/composition/use-widget-config";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import type { ValidatorInput as ValidatorDto } from "../../../../../domain/earn/validator";
import type { Token } from "../../../../../domain/token/token";
import {
  defaultFormattedNumber,
  formatNumber,
} from "../../../../../shared/lib/number-format";
import * as AmountToggle from "../../../../../shared/ui/components/amount-toggle";
import { AmountTokenSection } from "../../../../../shared/ui/components/amount-token-section";
import type { NumberInputProps } from "../../../../../shared/ui/components/number-input";
import { SelectedToken } from "../../../../../shared/ui/components/selected-token";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { InfoIcon } from "../../../../../shared/ui/primitives/icons/info";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useYieldMetaInfo } from "../../../../earn/components";

type AmountBlockProps = {
  onAmountChange: NumberInputProps["onChange"];
  value: NumberInputProps["value"];
  canChangeAmount: boolean;
  disabled?: boolean;
  onClick: () => void;
  unstakeAmountError?: boolean;
  onMaxClick: (() => void) | null;
  label: string;
  formattedAmount: string;
  balance: { amount: BigNumber; token: Token } | null;
} & (
  | {
      variant: "unstake";
      unstakeToken: Token;
      yieldDto: EarnYieldWithProvider;
      validators: {
        [Key in keyof Pick<
          ValidatorDto,
          "name" | "address"
        >]?: ValidatorDto[Key];
      }[];
      canUnstake: boolean;
      unstakeIsGreaterOrLessIntegrationLimitError: boolean;
      unstakeMaxAmount: string | number | null;
      unstakeMinAmount: string | number | null;
      /**
       * When false, the unstake info (withdrawal time, etc.) is not rendered
       * inside the card so it can be placed below the section instead.
       */
      showUnstakeInfo?: boolean;
      ctaPlacement?: "card" | "footer";
      /** Overrides the default position-token chip when CTA is in the footer. */
      tokenAccessory?: ReactNode;
    }
  | { variant: "action" }
);

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
  unstakeAmountError,
  ...rest
}: AmountBlockProps) => {
  const { t } = useTranslation();
  const dashboardVariant = useWidgetConfig("dashboardVariant");

  const unstakeProps =
    rest.variant === "unstake"
      ? (rest as Extract<AmountBlockProps, { variant: "unstake" }>)
      : null;
  const min =
    unstakeProps?.unstakeMinAmount == null
      ? null
      : `${t("shared.min")} ${formatNumber(
          new BigNumber(unstakeProps.unstakeMinAmount)
        )} ${unstakeProps.unstakeToken.symbol}`;
  const max =
    unstakeProps?.unstakeMaxAmount == null
      ? null
      : `${t("shared.max")} ${formatNumber(
          new BigNumber(unstakeProps.unstakeMaxAmount)
        )} ${unstakeProps.unstakeToken.symbol}`;
  const hasMinMax =
    !!unstakeProps &&
    !!(min || max || unstakeProps.unstakeIsGreaterOrLessIntegrationLimitError);
  const minMaxLabel = (() => {
    if (!hasMinMax) return null;
    if (min && max) return `${min} / ${max}`;
    return min ?? max;
  })();

  const showCardCta =
    rest.variant === "action" || rest.ctaPlacement !== "footer";
  const showAmount = rest.variant === "action" || rest.canUnstake;

  if (!showAmount) {
    if (rest.variant === "unstake" && rest.showUnstakeInfo !== false) {
      return (
        <Box>
          <UnstakeInfo
            validators={rest.validators}
            yieldDto={rest.yieldDto}
            unstakeToken={rest.unstakeToken}
          />
        </Box>
      );
    }
    return null;
  }

  const accessory = showCardCta ? (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={{
        size: "small",
        color: rest.variant === "unstake" ? "smallButton" : "smallButtonLight",
      }}
    >
      <Text>{label}</Text>
    </Button>
  ) : (
    (rest.tokenAccessory ?? <SelectedToken token={rest.unstakeToken} />)
  );

  const balanceContent = balance ? (
    <AmountToggle.Root>
      <AmountToggle.Amount>
        {({ state }) => (
          <span>
            {t("position_details.available", {
              amount:
                state === "full"
                  ? formatNumber(balance.amount)
                  : defaultFormattedNumber(balance.amount),
              symbol: balance.token?.symbol ?? "",
            })}
          </span>
        )}
      </AmountToggle.Amount>
    </AmountToggle.Root>
  ) : null;

  return (
    <AmountTokenSection
      value={value}
      onChange={onAmountChange}
      disabled={!canChangeAmount}
      isInvalid={unstakeAmountError}
      accessory={accessory}
      formattedPrice={formattedAmount}
      balance={balanceContent}
      onMaxClick={canChangeAmount ? onMaxClick : null}
      maxButtonProps={
        rest.variant === "action"
          ? { background: "backgroundMuted" as const }
          : undefined
      }
      minMaxLabel={minMaxLabel}
      minMaxError={
        unstakeProps?.unstakeIsGreaterOrLessIntegrationLimitError ?? false
      }
      state={unstakeAmountError ? "danger" : "default"}
      tone={rest.variant === "action" ? "action" : "stake"}
    >
      {rest.variant === "unstake" && rest.showUnstakeInfo !== false ? (
        <Box marginTop={dashboardVariant ? "0" : "2"}>
          <UnstakeInfo
            validators={rest.validators}
            yieldDto={rest.yieldDto}
            unstakeToken={rest.unstakeToken}
          />
        </Box>
      ) : null}
    </AmountTokenSection>
  );
};

export const UnstakeInfo = ({
  validators,
  yieldDto,
  unstakeToken,
}: {
  yieldDto: EarnYieldWithProvider;
  validators: {
    [Key in keyof Pick<ValidatorDto, "name" | "address">]?: ValidatorDto[Key];
  }[];
  unstakeToken: Token;
}) => {
  const { withdrawnTime, withdrawnNotAvailable, positionLocked } =
    useYieldMetaInfo({
      validators,
      selectedStake: yieldDto,
      tokenDto: unstakeToken,
    });

  return useMemo(() => {
    const values = [
      withdrawnTime,
      withdrawnNotAvailable,
      positionLocked,
    ].filter(Boolean);
    return values.length > 0 ? (
      <Box display="flex" flexDirection="column" gap="2">
        {values.map((v, i) => (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="flex-start"
            gap="1"
            key={i}
          >
            <Box display="flex" alignItems="center" justifyContent="center">
              <InfoIcon />
            </Box>

            <Text variant={{ type: "muted", size: "small" }}>{v}</Text>
          </Box>
        ))}
      </Box>
    ) : null;
  }, [withdrawnTime, withdrawnNotAvailable, positionLocked]);
};
