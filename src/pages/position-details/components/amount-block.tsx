import { useTranslation } from "react-i18next";
import type { BoxProps, NumberInputProps } from "../../../components";
import { Box, Button, NumberInput, Spinner, Text } from "../../../components";
import { formatNumber } from "../../../utils";
import { pressAnimation } from "../../../components/atoms/button/styles.css";
import type BigNumber from "bignumber.js";
import type { TokenDto, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import { useYieldMetaInfo } from "../../../hooks/use-yield-meta-info";
import { Just } from "purify-ts";
import { InfoIcon } from "../../../components/atoms/icons/info";
import type { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import { useMemo } from "react";

type AmountBlockProps = {
  isLoading: boolean;
  onAmountChange: NumberInputProps["onChange"];
  value: NumberInputProps["value"];
  canChangeAmount: boolean;
  disabled?: boolean;
  onClick: () => void;
  onMaxClick: (() => void) | null;
  label: string;
  formattedAmount: string;
  balance: { amount: BigNumber; token: TokenDto } | null;
} & (
  | {
      variant: "unstake";
      unstakeToken: ReturnType<
        typeof useUnstakeOrPendingActionState
      >["unstakeToken"];
      yieldDto: YieldDto;
      validators: {
        [Key in keyof Pick<
          ValidatorDto,
          "name" | "address"
        >]?: ValidatorDto[Key];
      }[];
      canUnstake: boolean;
    }
  | { variant: "action" }
);

export const AmountBlock = ({
  isLoading,
  onAmountChange,
  value,
  canChangeAmount,
  disabled,
  onClick,
  label,
  formattedAmount,
  onMaxClick,
  balance,
  ...rest
}: AmountBlockProps) => {
  const { t } = useTranslation();

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
              />
            </Box>

            {isLoading && (
              <Box marginRight="3" display="flex">
                <Spinner />
              </Box>
            )}

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

          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            marginTop="2"
            flexWrap="wrap"
          >
            <Box flex={1}>
              <Text variant={{ type: "muted", weight: "normal" }}>
                {formattedAmount}
              </Text>
            </Box>

            <Box display="flex" justifyContent="flex-end" alignItems="center">
              {balance && (
                <Text variant={{ weight: "normal" }}>
                  {t("position_details.available", {
                    amount: formatNumber(balance.amount),
                    symbol: balance.token?.symbol ?? "",
                  })}
                </Text>
              )}
              {canChangeAmount && onMaxClick && (
                <Box
                  as="button"
                  borderRadius="xl"
                  background={
                    rest.variant === "unstake"
                      ? "background"
                      : "backgroundMuted"
                  }
                  px="2"
                  py="1"
                  marginLeft="2"
                  onClick={onMaxClick}
                  className={pressAnimation}
                >
                  <Text variant={{ weight: "semibold", type: "regular" }}>
                    {t("shared.max")}
                  </Text>
                </Box>
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
  unstakeToken: ReturnType<
    typeof useUnstakeOrPendingActionState
  >["unstakeToken"];
}) => {
  const { withdrawnTime, withdrawnNotAvailable } = useYieldMetaInfo({
    validators,
    selectedStake: Just(yieldDto),
    tokenDto: unstakeToken,
  });

  return useMemo(
    () =>
      Just([withdrawnTime, withdrawnNotAvailable])
        .map((val) => val.filter((v): v is NonNullable<typeof v> => !!v))
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
