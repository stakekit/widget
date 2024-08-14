import { Box, NumberInput, Text } from "@sk-widget/components";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { MaxButton } from "@sk-widget/components/atoms/max-button";
import * as AmountToggle from "@sk-widget/components/molecules/amount-toggle";
import { priceTxt } from "@sk-widget/pages/details/earn-page/components/select-token-section/styles.css";
import { useEarnPageContext } from "@sk-widget/pages/details/earn-page/state/earn-page-context";
import { useSettings } from "@sk-widget/providers/settings";
import { Just } from "purify-ts";
import { useTranslation } from "react-i18next";
import { SelectToken } from "./select-token";
import { SelectTokenTitle } from "./title";

export const SelectTokenSection = () => {
  const { t } = useTranslation();

  const { variant } = useSettings();

  const {
    appLoading,
    selectedTokenAvailableAmount,
    formattedPrice,
    onMaxClick,
    onStakeAmountChange,
    stakeAmount,
    validation,
    selectTokenIsLoading,
    stakeMaxAmount,
    stakeMinAmount,
    symbol,
    isStakeTokenSameAsGasToken,
  } = useEarnPageContext();

  const isLoading = appLoading || selectTokenIsLoading;

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

  const minStakeAmount = Just([
    stakeMinAmount
      .map((v) => `${t("shared.min")} ${v} ${symbol}`)
      .extractNullable(),
    stakeMaxAmount
      .map((v) => `${t("shared.max")} ${v} ${symbol}`)
      .extractNullable(),
  ] as const)
    .filter((val) => val.some(Boolean))
    .map(([min, max]) => (
      <Box
        display="flex"
        justifyContent="flex-end"
        alignItems="center"
        {...(variant === "default" && { marginRight: "2", marginTop: "2" })}
        data-rk="stake-token-section-min-max"
      >
        <Text
          key="min"
          variant={{ type: stakeAmountLessThanMin ? "danger" : "muted" }}
        >
          {min && max ? `${min} / ${max}` : min ?? max}
        </Text>
      </Box>
    ))
    .extractNullable();

  return isLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={112.5} />
    </Box>
  ) : (
    <Box
      data-rk="stake-token-section"
      background="stakeSectionBackground"
      borderRadius="xl"
      marginTop="2"
      py="4"
      px="4"
      borderStyle="solid"
      borderWidth={1}
      borderColor={
        submitted && stakeAmountIsZero ? "textDanger" : "transparent"
      }
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
            onChange={onStakeAmountChange}
            value={stakeAmount}
          />
        </Box>

        <Box display="flex" justifyContent="center" alignItems="center">
          <SelectToken />
        </Box>
      </Box>

      {variant === "default" && minStakeAmount}

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
          <Text variant={{ type: "muted", weight: "normal" }}>
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
            >
              {selectedTokenAvailableAmount
                .map((v) =>
                  variant === "zerion" ? (
                    <>
                      <span>{t("shared.balance")}:&nbsp;</span>
                      <Box
                        {...(isStakeTokenSameAsGasToken
                          ? { as: "span" }
                          : {
                              onClick: onMaxClick,
                              as: "button",
                            })}
                      >
                        {v.shortFormattedAmount}&nbsp;{v.symbol}
                      </Box>
                    </>
                  ) : (
                    <AmountToggle.Root>
                      <AmountToggle.Amount>
                        {({ state }) => (
                          <span>
                            {state === "full"
                              ? v.fullFormattedAmount
                              : v.shortFormattedAmount}
                            &nbsp;{v.symbol}&nbsp;{t("shared.available")}
                          </span>
                        )}
                      </AmountToggle.Amount>
                    </AmountToggle.Root>
                  )
                )
                .extractNullable()}
            </Text>
          </Box>

          {!isStakeTokenSameAsGasToken && <MaxButton onMaxClick={onMaxClick} />}
        </Box>
      </Box>
    </Box>
  );
};
