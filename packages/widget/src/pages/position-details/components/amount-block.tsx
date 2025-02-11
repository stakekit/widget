import {
  Box,
  type BoxProps,
  Button,
  NumberInput,
  type NumberInputProps,
  Text,
} from "@sk-widget/components";
import { InfoIcon } from "@sk-widget/components/atoms/icons/info";
import { MaxButton } from "@sk-widget/components/atoms/max-button";
import * as AmountToggle from "@sk-widget/components/molecules/amount-toggle";
import { useYieldMetaInfo } from "@sk-widget/hooks/use-yield-meta-info";
import { priceTxt } from "@sk-widget/pages/position-details/styles.css";
import { defaultFormattedNumber, formatNumber } from "@sk-widget/utils";
import type { TokenDto, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Just, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

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
  balance: { amount: BigNumber; token: TokenDto } | null;
} & (
  | {
      variant: "unstake";
      unstakeToken: TokenDto;
      yieldDto: YieldDto;
      validators: {
        [Key in keyof Pick<
          ValidatorDto,
          "name" | "address"
        >]?: ValidatorDto[Key];
      }[];
      canUnstake: boolean;
      unstakeIsGreaterOrLessIntegrationLimitError: boolean;
      unstakeMaxAmount: Maybe<number>;
      unstakeMinAmount: Maybe<number>;
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

  const minMaxUnstakeAmount = Maybe.fromPredicate(
    (v) => v.variant === "unstake",
    rest as Extract<AmountBlockProps, { variant: "unstake" }>
  )
    .map(
      (val) =>
        [
          val.unstakeMinAmount
            .map(
              (v) =>
                `${t("shared.min")} ${formatNumber(new BigNumber(v))} ${val.unstakeToken.symbol}`
            )
            .extractNullable(),
          val.unstakeMaxAmount
            .map(
              (v) =>
                `${t("shared.max")} ${formatNumber(new BigNumber(v))} ${val.unstakeToken.symbol}`
            )
            .extractNullable(),
          val.unstakeIsGreaterOrLessIntegrationLimitError,
        ] as const
    )
    .filter((val) => val.some(Boolean))
    .map(([min, max, error]) => (
      <Box
        display="flex"
        justifyContent="flex-end"
        alignItems="center"
        marginTop="2"
        marginRight="2"
      >
        <Text
          key="min"
          variant={{ type: error ? "danger" : "muted" }}
          textAlign="right"
        >
          {min && max ? `${min} / ${max}` : (min ?? max)}
        </Text>
      </Box>
    ))
    .extractNullable();

  const variantProps: BoxProps =
    rest.variant === "action"
      ? {
          background: "background",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "backgroundMuted",
        }
      : { background: "stakeSectionBackground" };

  return (
    <Box {...variantProps} borderRadius="xl" marginTop="2" py="4" px="4">
      {(rest.variant === "action" || rest.canUnstake) && (
        <Box marginBottom="3">
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box minWidth="0" display="flex" marginRight="2" flex={1}>
              <NumberInput
                onChange={onAmountChange}
                value={value}
                disabled={!canChangeAmount}
                shakeOnInvalid
                isInvalid={unstakeAmountError}
              />
            </Box>

            <Button
              onClick={onClick}
              disabled={disabled}
              variant={{
                size: "small",
                color:
                  rest.variant === "unstake"
                    ? "smallButton"
                    : "smallButtonLight",
              }}
            >
              <Text>{label}</Text>
            </Button>
          </Box>
          {minMaxUnstakeAmount}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            marginTop="2"
            flexWrap="wrap"
          >
            <Box className={priceTxt}>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {formattedAmount}
              </Text>
            </Box>

            <Box
              flexGrow={1}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              {balance && (
                <AmountToggle.Root>
                  <AmountToggle.Amount>
                    {({ state }) => (
                      <Text variant={{ weight: "normal" }}>
                        {t("position_details.available", {
                          amount:
                            state === "full"
                              ? formatNumber(balance.amount)
                              : defaultFormattedNumber(balance.amount),
                          symbol: balance.token?.symbol ?? "",
                        })}
                      </Text>
                    )}
                  </AmountToggle.Amount>
                </AmountToggle.Root>
              )}
              {canChangeAmount && onMaxClick && (
                <MaxButton
                  onMaxClick={onMaxClick}
                  background={
                    rest.variant === "unstake"
                      ? "background"
                      : "backgroundMuted"
                  }
                />
              )}
            </Box>
          </Box>
        </Box>
      )}

      {rest.variant === "unstake" && (
        <Box>
          <UnstakeInfo
            validators={rest.validators}
            yieldDto={rest.yieldDto}
            unstakeToken={rest.unstakeToken}
          />
        </Box>
      )}
    </Box>
  );
};

const UnstakeInfo = ({
  validators,
  yieldDto,
  unstakeToken,
}: {
  yieldDto: YieldDto;
  validators: {
    [Key in keyof Pick<ValidatorDto, "name" | "address">]?: ValidatorDto[Key];
  }[];
  unstakeToken: TokenDto;
}) => {
  const { withdrawnTime, withdrawnNotAvailable } = useYieldMetaInfo({
    validators,
    selectedStake: Just(yieldDto),
    tokenDto: Just(unstakeToken),
  });

  return useMemo(
    () =>
      Just([withdrawnTime, withdrawnNotAvailable])
        .map((val) => val.filter((v) => v !== null))
        .filter((val) => !!val.length)
        .map((val) => (
          <Box display="flex" flexDirection="column" gap="2">
            {val.map((v, i) => (
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
        ))
        .extractNullable(),
    [withdrawnTime, withdrawnNotAvailable]
  );
};
