import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  formatNumber,
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import * as AmountToggle from "../../../../../shared/ui/components/amount-toggle";
import { AmountTokenSection } from "../../../../../shared/ui/components/amount-token-section";
import { minMaxContainer } from "../../../../../shared/ui/components/amount-token-section/styles.css";
import { Box, type BoxProps } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import { ConfidentialTokenBalance } from "../../../../yield-entry/views";
import {
  useEarnEntry,
  useEarnTokenSelection,
} from "../../../react/use-earn-facades";
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
  const { locale } = useWidgetPresentation();

  const variant = useWidgetConfig("variant");
  const { earnPresentation } = useWidgetConfig("hostProfile");

  const {
    hideTokenBalance,
    revealTokenBalance,
    revealTokenBalanceStatus,
    setAmount,
    setMaxAmount,
    view,
  } = useEarnEntry();
  const { view: tokenSelection } = useEarnTokenSelection();
  const {
    appLoading,
    selectedTokenAvailableAmount,
    priceUsd,
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
      : `${t("shared.min")} ${formatTokenAmount(stakeMinAmount, locale, "up")} ${symbol}`;
  const max =
    stakeMaxAmount === null
      ? null
      : `${t("shared.max")} ${formatTokenAmount(stakeMaxAmount, locale, "down")} ${symbol}`;
  const minMaxLabel = min && max ? `${min} / ${max}` : (min ?? max);
  const getBalanceContent = (): ReactNode => {
    if (!selectedTokenAvailableAmount) return null;
    const shortFormattedAmount = formatTokenAmount(
      selectedTokenAvailableAmount.amount,
      locale,
      "down"
    );
    if (earnPresentation.zerion) {
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
            {shortFormattedAmount}&nbsp;
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
                ? formatNumber(selectedTokenAvailableAmount.amount, locale)
                : shortFormattedAmount}
              &nbsp;{selectedTokenAvailableAmount.symbol}&nbsp;
              {t("shared.available")}
            </span>
          )}
        </AmountToggle.Amount>
      </AmountToggle.Root>
    );
  };
  const balanceContent =
    view.hiddenTokenBalance || selectedTokenAvailableAmount ? (
      <ConfidentialTokenBalance
        hidden={view.hiddenTokenBalance}
        revealed={view.revealedTokenBalance}
        revealStatus={revealTokenBalanceStatus}
        onReveal={() => revealTokenBalance(undefined)}
        onHide={() => hideTokenBalance(undefined)}
        symbol={symbol}
      >
        {getBalanceContent()}
      </ConfidentialTokenBalance>
    ) : null;

  if (isLoading) {
    return (
      <Box marginTop={sectionMarginTop}>
        <ContentLoaderSquare heightPx={112.5} />
      </Box>
    );
  }

  // Zerion places the title and min/max in a header row above the input.
  const zerionHeader = earnPresentation.zerion ? (
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
          <Text variant={{ type: stakeAmountLessThanMin ? "danger" : "muted" }}>
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
      formattedPrice={priceUsd ? formatUsd(priceUsd, locale) : ""}
      balance={balanceContent}
      balanceError={stakeAmountGreaterThanAvailableAmount}
      // A hidden balance has no known maximum yet.
      onMaxClick={
        isStakeTokenSameAsGasToken || view.hiddenTokenBalance
          ? null
          : () => setMaxAmount(undefined)
      }
      minMaxLabel={earnPresentation.zerion ? null : minMaxLabel}
      minMaxError={stakeAmountLessThanMin}
      state={submitted && stakeAmountIsZero ? "danger" : "default"}
      marginTop={sectionMarginTop}
      header={zerionHeader}
    />
  );
};
