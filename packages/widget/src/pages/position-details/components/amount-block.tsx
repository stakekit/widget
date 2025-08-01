import type { TokenDto, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Just, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, type BoxProps } from "../../../components/atoms/box";
import { Button } from "../../../components/atoms/button";
import { InfoIcon } from "../../../components/atoms/icons/info";
import { MaxButton } from "../../../components/atoms/max-button";
import {
  NumberInput,
  type NumberInputProps,
} from "../../../components/atoms/number-input";
import { Text } from "../../../components/atoms/typography/text";
import * as AmountToggle from "../../../components/molecules/amount-toggle";
import { useYieldMetaInfo } from "../../../hooks/use-yield-meta-info";
import { defaultFormattedNumber, formatNumber } from "../../../utils";
import { priceTxt } from "../styles.css";

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
    <Box {...variantProps} borderRadius="xl" py="4" px="4">
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
  const { withdrawnTime, withdrawnNotAvailable, positionLocked } =
    useYieldMetaInfo({
      validators,
      selectedStake: Just(yieldDto),
      tokenDto: Just(unstakeToken),
    });

  return useMemo(
    () =>
      Just([withdrawnTime, withdrawnNotAvailable, positionLocked])
        .map((val) => val.filter((v) => !!v))
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
    [withdrawnTime, withdrawnNotAvailable, positionLocked]
  );
};
