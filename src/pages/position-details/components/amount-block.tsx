import { useTranslation } from "react-i18next";
import {
  Box,
  BoxProps,
  Button,
  NumberInput,
  NumberInputProps,
  Spinner,
  Text,
} from "../../../components";
import { formatNumber } from "../../../utils";
import { pressAnimation } from "../../../components/atoms/button/styles.css";
import BigNumber from "bignumber.js";
import { TokenDto, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import { useYieldMetaInfo } from "../../../hooks/use-yield-meta-info";
import { Just, Maybe } from "purify-ts";
import { InfoIcon } from "../../../components/atoms/icons/info";

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
      yieldDto: YieldDto;
      validators: {
        [Key in keyof Pick<
          ValidatorDto,
          "name" | "address"
        >]?: ValidatorDto[Key];
      }[];
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
      <Box display="flex" justifyContent="space-between" alignItems="center">
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
              rest.variant === "unstake" ? "smallButton" : "smallButtonLight",
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
                rest.variant === "unstake" ? "background" : "backgroundMuted"
              }
              px="2"
              py="1"
              marginLeft="2"
              onClick={onMaxClick}
              className={pressAnimation}
            >
              <Text
                variant={{
                  weight: "semibold",
                  type: "regular",
                }}
              >
                {t("shared.max")}
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {rest.variant === "unstake" && (
        <Box marginTop="2">
          <UnstakeInfo validators={rest.validators} yieldDto={rest.yieldDto} />
        </Box>
      )}
    </Box>
  );
};

const UnstakeInfo = ({
  validators,
  yieldDto,
}: {
  yieldDto: YieldDto;
  validators: {
    [Key in keyof Pick<ValidatorDto, "name" | "address">]?: ValidatorDto[Key];
  }[];
}) => {
  const { withdrawnTime } = useYieldMetaInfo({
    validators,
    selectedStake: Just(yieldDto),
  });

  return Maybe.fromNullable(withdrawnTime)
    .map((time) => (
      <Box
        display="flex"
        alignItems="flex-start"
        justifyContent="center"
        gap="1"
      >
        <InfoIcon />
        <Text variant={{ type: "muted", size: "small" }}>{time}</Text>
      </Box>
    ))
    .extractNullable();
};
