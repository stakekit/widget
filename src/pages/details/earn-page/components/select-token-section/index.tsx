import { useTranslation } from "react-i18next";
import { Box, NumberInput, Spinner, Text } from "../../../../../components";
import { pressAnimation } from "../../../../../components/atoms/button/styles.css";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { SelectToken } from "./select-token";
import { useDetailsContext } from "../../state/details-context";
import { useSettings } from "../../../../../providers/settings";
import { SelectTokenTitle } from "./title";
import { Maybe } from "purify-ts";

export const SelectTokenSection = () => {
  const { t } = useTranslation();

  const { variant } = useSettings();

  const {
    appLoading,
    tokenBalancesScanLoading,
    availableTokens,
    formattedPrice,
    onMaxClick,
    onStakeAmountChange,
    stakeAmount,
    stakeTokenAvailableAmountLoading,
    defaultTokensIsLoading,
    validation,
  } = useDetailsContext();

  const isLoading =
    appLoading || tokenBalancesScanLoading || defaultTokensIsLoading;

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
        validation.submitted && validation.errors.amountZero
          ? "textDanger"
          : "transparent"
      }
    >
      {variant === "zerion" && <SelectTokenTitle />}

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box minWidth="0" display="flex" flex={1}>
          <NumberInput onChange={onStakeAmountChange} value={stakeAmount} />
        </Box>

        <Box display="flex" justifyContent="center" alignItems="center">
          <SelectToken />
        </Box>
      </Box>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        marginTop="2"
        flexWrap="wrap"
      >
        <Box flex={1} display="flex">
          <Text variant={{ type: "muted", weight: "normal" }}>
            {formattedPrice}
          </Text>
        </Box>

        <Box display="flex" justifyContent="flex-end" alignItems="center">
          <Box display="flex">
            {stakeTokenAvailableAmountLoading ? (
              <Spinner />
            ) : (
              <Text
                variant={{
                  weight: "normal",
                  type: validation.errors.amountInvalid ? "danger" : "muted",
                }}
                data-state={validation.errors.amountInvalid ? "error" : "valid"}
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
            )}
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
