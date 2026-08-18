import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../features/widget-configuration/index";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import * as AmountToggle from "../../../../../../../shared/ui/components/amount-toggle";
import {
  minMaxContainer,
  priceTxt,
  selectTokenBalance,
  selectTokenSection,
} from "../../../../../../../shared/ui/components/amount-token-section/styles.css";
import { MaxButton } from "../../../../../../../shared/ui/components/max-button";
import { NumberInput } from "../../../../../../../shared/ui/components/number-input";
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

  const errorBalance = stakeAmountGreaterThanAvailableAmount;

  const min =
    stakeMinAmount === null
      ? null
      : `${t("shared.min")} ${stakeMinAmount} ${symbol}`;
  const max =
    stakeMaxAmount === null
      ? null
      : `${t("shared.max")} ${stakeMaxAmount} ${symbol}`;
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
          {min && max ? `${min} / ${max}` : (min ?? max)}
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
    <Box marginTop={sectionMarginTop}>
      <ContentLoaderSquare heightPx={112.5} />
    </Box>
  ) : (
    <Box>
      <Box
        data-rk="stake-token-section"
        background="stakeSectionBackground"
        marginTop={sectionMarginTop}
        py="4"
        px="4"
        borderStyle="solid"
        borderWidth={1}
        className={combineRecipeWithVariant({
          rec: selectTokenSection,
          variant,
          state: submitted && stakeAmountIsZero ? "danger" : "default",
        })}
      >
        {variant === "zerion" && (
          <Box display="flex" justifyContent="space-between">
            <SelectTokenTitle />
            {minStakeAmount}
          </Box>
        )}

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box minWidth="0" display="flex" flex={1}>
            <NumberInput
              shakeOnInvalid
              isInvalid={errorInput}
              onChange={setAmount}
              value={stakeAmount}
            />
          </Box>

          <Box display="flex" justifyContent="center" alignItems="center">
            <SelectToken canSelect={canSelectToken} />
          </Box>
        </Box>

        {variant !== "zerion" && minStakeAmount}

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          marginTop="2"
          flexWrap="wrap"
          data-rk="stake-token-section-balance"
          gap="1"
        >
          <Box className={priceTxt} display="flex">
            <Text
              variant={{ type: "muted", weight: "normal" }}
              className={combineRecipeWithVariant({
                rec: selectTokenBalance,
                variant,
              })}
            >
              {formattedPrice}
            </Text>
          </Box>

          <Box
            flexGrow={1}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box display="flex">
              <Text
                variant={{
                  weight: "normal",
                  type: errorBalance ? "danger" : "muted",
                }}
                data-state={errorBalance ? "error" : "valid"}
                className={combineRecipeWithVariant({
                  rec: selectTokenBalance,
                  variant,
                })}
              >
                {balanceContent}
              </Text>
            </Box>

            {!isStakeTokenSameAsGasToken && (
              <MaxButton onMaxClick={() => setMaxAmount(undefined)} />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
