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
import { ContentLoaderSquare } from "../../../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import {
  useEarnEntry,
  useEarnTokenSelection,
} from "../../../../../react/use-earn-facades";
import { SelectToken } from "./select-token";
import { SelectTokenTitle } from "./title";

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

  const min =
    stakeMinAmount === null
      ? null
      : `${t("shared.min")} ${formatNumber(stakeMinAmount)} ${symbol}`;
  const max =
    stakeMaxAmount === null
      ? null
      : `${t("shared.max")} ${formatNumber(stakeMaxAmount)} ${symbol}`;
  const minMaxLabel = min && max ? `${min} / ${max}` : (min ?? max);
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

  if (isLoading) {
    return (
      <Box marginTop={sectionMarginTop}>
        <ContentLoaderSquare heightPx={112.5} />
      </Box>
    );
  }

  // Zerion places the title and min/max in a header row above the input.
  const zerionHeader =
    variant === "zerion" ? (
      <Box display="flex" justifyContent="space-between">
        <SelectTokenTitle />
        {minMaxLabel ? (
          <Box
            className={combineRecipeWithVariant({
              rec: minMaxContainer,
              variant,
            })}
            data-rk="stake-token-section-min-max"
          >
            <Text
              variant={{ type: stakeAmountLessThanMin ? "danger" : "muted" }}
            >
              {minMaxLabel}
            </Text>
          </Box>
        ) : null}
      </Box>
    ) : null;

  return (
    <AmountTokenSection
      value={stakeAmount}
      onChange={setAmount}
      isInvalid={errorInput}
      accessory={<SelectToken canSelect={canSelectToken} />}
      formattedPrice={formattedPrice}
      balance={getBalanceContent()}
      balanceError={stakeAmountGreaterThanAvailableAmount}
      onMaxClick={
        isStakeTokenSameAsGasToken ? null : () => setMaxAmount(undefined)
      }
      minMaxLabel={variant === "zerion" ? null : minMaxLabel}
      minMaxError={stakeAmountLessThanMin}
      state={submitted && stakeAmountIsZero ? "danger" : "default"}
      marginTop={sectionMarginTop}
      header={zerionHeader}
    />
  );
};
