import { useTranslation } from "react-i18next";
import { Box, NumberInput, Spinner, Text } from "../../../../../components";
import { pressAnimation } from "../../../../../components/atoms/button/styles.css";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { SelectToken } from "./select-token";
import { useDetailsContext } from "../../state/details-context";

export const SelectTokenSection = () => {
  const { t } = useTranslation();

  const {
    appLoading,
    tokenBalancesScanLoading,
    amountValid,
    availableTokens,
    formattedPrice,
    onMaxClick,
    onStakeAmountChange,
    stakeAmount,
    stakeTokenAvailableAmountLoading,
    defaultTokensIsLoading,
  } = useDetailsContext();

  const isLoading =
    appLoading || tokenBalancesScanLoading || defaultTokensIsLoading;

  return isLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={112.5} />
    </Box>
  ) : (
    <Box
      background="stakeSectionBackground"
      borderRadius="xl"
      marginTop="2"
      py="4"
      px="4"
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box minWidth="0" display="flex" marginRight="2" flex={1}>
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
        <Box flex={1}>
          <Text
            variant={{
              type: "muted",
              weight: "normal",
            }}
          >
            {formattedPrice}
          </Text>
        </Box>

        <Box display="flex" justifyContent="flex-end" alignItems="center">
          {stakeTokenAvailableAmountLoading ? (
            <Spinner />
          ) : (
            <Text
              variant={{
                type: amountValid ? "muted" : "danger",
                weight: "normal",
              }}
            >
              {availableTokens
                ? `${availableTokens} ${t("shared.available")}`
                : ""}
            </Text>
          )}
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
            <Text
              variant={{
                weight: "semibold",
                type: "regular",
              }}
            >
              {t("shared.max")}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
