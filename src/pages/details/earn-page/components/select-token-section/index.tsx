import { useTranslation } from "react-i18next";
import { Box, NumberInput, Text } from "../../../../../components";
import { pressAnimation } from "../../../../../components/atoms/button/styles.css";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { SelectToken } from "./select-token";
import { useDetailsContext } from "../../state/details-context";
import { useSettings } from "../../../../../providers/settings";
import { Just, Maybe } from "purify-ts";
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
  } = useDetailsContext();

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
      {variant === "zerion" && <SelectTokenTitle />}

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

      {Just([
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
            marginRight="2"
            marginTop="2"
            data-rk="stake-token-section-min-max"
          >
            <Text
              key="min"
              variant={{ type: stakeAmountLessThanMin ? "danger" : "muted" }}
            >
              {!!(min && max) ? `${min} / ${max}` : min ?? max}
            </Text>
          </Box>
        ))
        .extractNullable()}

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
                      <span>{t("shared.balance")}</span> <span>{v}</span>
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
        </Box>
      </Box>
    </Box>
  );
};
