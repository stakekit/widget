import { Just, Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box, NumberInput, Text } from "../../../../../components";
import { pressAnimation } from "../../../../../components/atoms/button/styles.css";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { useSettings } from "../../../../../providers/settings";
import { useEarnPageContext } from "../../state/earn-page-context";
import { SelectToken } from "./select-token";
import { SelectTokenTitle } from "./title";

export const SelectTokenSection = () => {
  const { t } = useTranslation();

  const { variant } = useSettings();

  const {
    appLoading,
    availableTokens,
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
      >
        <Box flex={1} display="flex">
          <Text variant={{ type: "muted", weight: "normal" }}>
            {formattedPrice}
          </Text>
        </Box>

        <Box display="flex" justifyContent="flex-end" alignItems="center">
          <Box display="flex">
            <Text
              variant={{
                weight: "normal",
                type: errorBalance ? "danger" : "muted",
              }}
              data-state={errorBalance ? "error" : "valid"}
            >
              {Maybe.fromNullable(availableTokens)
                .map((v) =>
                  variant === "zerion" ? (
                    <>
                      <span>{t("shared.balance")}:</span>{" "}
                      {
                        <Box
                          {...(isStakeTokenSameAsGasToken
                            ? { as: "span" }
                            : {
                                onClick: onMaxClick,
                                as: "button",
                              })}
                        >
                          {v}
                        </Box>
                      }
                    </>
                  ) : (
                    <>
                      <span>{v}</span> <span>{t("shared.available")}</span>
                    </>
                  )
                )
                .extractNullable()}
            </Text>
          </Box>

          {!isStakeTokenSameAsGasToken && (
            <Box
              as="button"
              borderRadius="xl"
              background="background"
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
  );
};
