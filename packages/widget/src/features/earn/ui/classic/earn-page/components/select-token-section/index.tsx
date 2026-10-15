import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../features/widget-configuration/index";
import {
  formatNumber,
  formatTokenAmount,
  formatUsd,
} from "../../../../../../../shared/lib/number-format";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import * as AmountToggle from "../../../../../../../shared/ui/components/amount-toggle";
import { AmountTokenSection } from "../../../../../../../shared/ui/components/amount-token-section";
import { minMaxContainer } from "../../../../../../../shared/ui/components/amount-token-section/styles.css";
import {
  Box,
  type BoxProps,
} from "../../../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../../../shared/ui/primitives/button";
import { ContentLoaderSquare } from "../../../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { useWidgetPresentation } from "../../../../../../../shared/ui/widget-presentation";
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
      : `${t("shared.min")} ${formatNumber(stakeMinAmount, locale)} ${symbol}`;
  const max =
    stakeMaxAmount === null
      ? null
      : `${t("shared.max")} ${formatNumber(stakeMaxAmount, locale)} ${symbol}`;
  const minMaxLabel = min && max ? `${min} / ${max}` : (min ?? max);
  const getBalanceContent = (): ReactNode => {
    if (view.hiddenTokenBalance) {
      return (
        <Button
          variant={{ size: "small", color: "smallButtonLight" }}
          disabled={revealTokenBalanceStatus.revealing}
          isLoading={revealTokenBalanceStatus.revealing}
          onClick={() => revealTokenBalance(undefined)}
        >
          <Text>
            {revealTokenBalanceStatus.failed
              ? t("shared.confidential.reveal_failed")
              : t("shared.confidential.reveal")}
          </Text>
        </Button>
      );
    }
    if (!selectedTokenAvailableAmount) return null;
    const shortFormattedAmount = formatTokenAmount(
      selectedTokenAvailableAmount.amount,
      locale
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
  const balanceContent = view.revealedTokenBalance ? (
    <>
      {getBalanceContent()}
      <Button
        variant={{ size: "small", color: "smallButtonLight" }}
        onClick={() => hideTokenBalance(undefined)}
      >
        <Text>{t("shared.confidential.hide")}</Text>
      </Button>
    </>
  ) : (
    getBalanceContent()
  );

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
      onMaxClick={
        isStakeTokenSameAsGasToken ? null : () => setMaxAmount(undefined)
      }
      minMaxLabel={earnPresentation.zerion ? null : minMaxLabel}
      minMaxError={stakeAmountLessThanMin}
      state={submitted && stakeAmountIsZero ? "danger" : "default"}
      marginTop={sectionMarginTop}
      header={zerionHeader}
    />
  );
};
