import { Box } from "@sk-widget/components/atoms/box";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { Balance } from "@sk-widget/components/atoms/icons/balance";
import { MaxButton } from "@sk-widget/components/atoms/max-button";
import { NumberInput } from "@sk-widget/components/atoms/number-input";
import { Text } from "@sk-widget/components/atoms/typography/text";
import * as AmountToggle from "@sk-widget/components/molecules/amount-toggle";
import { isUSDeToken } from "@sk-widget/domain/types/tokens";
import {
  bottomBanner,
  bottomBannerBottomRadius,
  bottomBannerText,
  priceTxt,
  selectTokenSection,
} from "@sk-widget/pages/details/earn-page/components/select-token-section/styles.css";
import { useEarnPageContext } from "@sk-widget/pages/details/earn-page/state/earn-page-context";
import { useSettings } from "@sk-widget/providers/settings";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";
import clsx from "clsx";
import { Just, Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { SelectToken } from "./select-token";
import { SelectTokenTitle } from "./title";

export const SelectTokenSection = () => {
  const { t } = useTranslation();

  const { variant, showUSDeBanner } = useSettings();

  const { isLedgerLive } = useSKWallet();

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
    selectedToken,
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

  const showBottomUSDeBanner = Maybe.fromRecord({
    selectedTokenAvailableAmount,
    selectedToken,
  })
    .filter(
      (val) =>
        !!showUSDeBanner &&
        isLedgerLive &&
        val.selectedTokenAvailableAmount.amount.isZero() &&
        isUSDeToken(val.selectedToken)
    )
    .isJust();

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
        {...(variant !== "zerion" && { marginRight: "2", marginTop: "2" })}
        data-rk="stake-token-section-min-max"
      >
        <Text
          key="min"
          variant={{ type: stakeAmountLessThanMin ? "danger" : "muted" }}
        >
          {min && max ? `${min} / ${max}` : (min ?? max)}
        </Text>
      </Box>
    ))
    .extractNullable();

  return isLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={112.5} />
    </Box>
  ) : (
    <Box>
      <Box
        data-rk="stake-token-section"
        background="stakeSectionBackground"
        borderRadius="xl"
        marginTop="2"
        py="4"
        px="4"
        borderStyle="solid"
        borderWidth={1}
        className={clsx(
          {
            [bottomBannerBottomRadius]: showBottomUSDeBanner,
          },
          combineRecipeWithVariant({
            rec: selectTokenSection,
            variant,
            state: submitted && stakeAmountIsZero ? "danger" : "default",
          })
        )}
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

            {!isStakeTokenSameAsGasToken && (
              <MaxButton onMaxClick={onMaxClick} />
            )}
          </Box>
        </Box>
      </Box>

      {showBottomUSDeBanner && (
        <Box
          className={bottomBanner}
          px="2"
          py="3"
          display="flex"
          gap="2"
          justifyContent="center"
        >
          <Balance />
          <Text className={bottomBannerText}>
            {t("select_token.usde_banner")}
          </Text>
        </Box>
      )}
    </Box>
  );
};
