import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../features/widget-configuration/index";
import { formatNumber } from "../../../../../../../shared/lib/number-format";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import * as AmountToggle from "../../../../../../../shared/ui/components/amount-toggle";
import { AmountTokenSection } from "../../../../../../../shared/ui/components/amount-token-section";
import { minMaxContainer } from "../../../../../../../shared/ui/components/amount-token-section/styles.css";
import {
  Box,
  type BoxProps,
} from "../../../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import {
  useEarnEntry,
  useEarnTokenSelection,
} from "../../../../../react/use-earn-facades";
import { SelectToken, SelectTokenTrigger } from "./select-token";
import { SelectTokenTitle, SelectTokenTitleView } from "./title";

export const SelectTokenSectionSkeleton = ({
  canSelectToken = true,
  sectionMarginTop = "2",
}: {
  canSelectToken?: boolean;
  sectionMarginTop?: BoxProps["marginTop"];
} = {}) => {
  const variant = useWidgetConfig("variant");
  return (
    <AmountTokenSection
      loading
      marginTop={sectionMarginTop}
      accessory={<SelectTokenTrigger canSelect={canSelectToken} />}
      header={
        variant === "zerion" ? (
          <Box display="flex" justifyContent="space-between">
            <SelectTokenTitleView isLoading />
          </Box>
        ) : undefined
      }
    />
  );
};

export const SelectTokenSection = ({
  canSelectToken = true,
  sectionMarginTop = "2",
}: {
  canSelectToken?: boolean;
  sectionMarginTop?: BoxProps["marginTop"];
} = {}) => {
  const { t } = useTranslation();

  const variant = useWidgetConfig("variant");

  const { setAmount, setMaxAmount, view } = useEarnEntry();
  const { view: tokenSelection } = useEarnTokenSelection();
  const {
    appLoading,
    selectedTokenAvailableAmount,
    formattedPrice,
    stakeAmount,
    validation,
    stakeMaxAmount,
    stakeMinAmount,
    symbol,
    isStakeTokenSameAsGasToken,
  } = view;

  const isLoading = appLoading || tokenSelection.isLoading;

  const {
    submitted,
    errors: {
      stakeAmountGreaterThanAvailableAmount,
      stakeAmountGreaterThanMax,
      stakeAmountLessThanMin,
      stakeAmountIsZero,
    },
  } = validation;

  const errorInput =
    (submitted && stakeAmountIsZero) ||
    stakeAmountGreaterThanAvailableAmount ||
    stakeAmountGreaterThanMax ||
    stakeAmountLessThanMin;

  const errorBalance = stakeAmountGreaterThanAvailableAmount;

  const min =
    stakeMinAmount === null
      ? null
      : `${t("shared.min")} ${formatNumber(stakeMinAmount)} ${symbol}`;
  const max =
    stakeMaxAmount === null
      ? null
      : `${t("shared.max")} ${formatNumber(stakeMaxAmount)} ${symbol}`;
  const minMaxLabel = min && max ? `${min} / ${max}` : (min ?? max);
  const minStakeAmount =
    min || max ? (
      <Box
        className={combineRecipeWithVariant({
          rec: minMaxContainer,
          variant,
        })}
        data-rk="stake-token-section-min-max"
      >
        <Text
          key="min"
          variant={{ type: stakeAmountLessThanMin ? "danger" : "muted" }}
        >
          {minMaxLabel}
        </Text>
      </Box>
    ) : null;
  const getBalanceContent = (): ReactNode => {
    if (!selectedTokenAvailableAmount) return null;
    if (variant === "zerion") {
      return (
        <>
          <span>{t("shared.balance")}:&nbsp;</span>
          <Box
            {...(isStakeTokenSameAsGasToken
              ? { as: "span" }
              : {
                  onClick: () => setMaxAmount(undefined),
                  as: "button",
                })}
          >
            {selectedTokenAvailableAmount.shortFormattedAmount}&nbsp;
            {selectedTokenAvailableAmount.symbol}
          </Box>
        </>
      );
    }
    return (
      <AmountToggle.Root>
        <AmountToggle.Amount>
          {({ state }) => (
            <span>
              {state === "full"
                ? selectedTokenAvailableAmount.fullFormattedAmount
                : selectedTokenAvailableAmount.shortFormattedAmount}
              &nbsp;{selectedTokenAvailableAmount.symbol}&nbsp;
              {t("shared.available")}
            </span>
          )}
        </AmountToggle.Amount>
      </AmountToggle.Root>
    );
  };
  const balanceContent = getBalanceContent();

  return isLoading ? (
    <SelectTokenSectionSkeleton
      canSelectToken={canSelectToken}
      sectionMarginTop={sectionMarginTop}
    />
  ) : (
    <Box>
      <AmountTokenSection
        value={stakeAmount}
        onChange={setAmount}
        isInvalid={errorInput}
        state={submitted && stakeAmountIsZero ? "danger" : "default"}
        marginTop={sectionMarginTop}
        accessory={<SelectToken canSelect={canSelectToken} />}
        formattedPrice={formattedPrice}
        balance={balanceContent}
        balanceError={errorBalance}
        onMaxClick={
          isStakeTokenSameAsGasToken ? undefined : () => setMaxAmount(undefined)
        }
        minMaxLabel={variant === "zerion" ? undefined : minMaxLabel}
        minMaxError={stakeAmountLessThanMin}
        minMaxTextAlign="left"
        header={
          variant === "zerion" ? (
            <Box display="flex" justifyContent="space-between">
              <SelectTokenTitle />
              {minStakeAmount}
            </Box>
          ) : undefined
        }
      />
    </Box>
  );
};
