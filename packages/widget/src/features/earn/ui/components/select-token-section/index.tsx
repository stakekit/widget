import { useTranslation } from "react-i18next";
import { getYieldTypeLabels } from "../../../../../domain/earn/yield";
import {
  amountSeparators,
  fromAmountValue,
  toAmountValue,
} from "../../../../../shared/lib/amount-value";
import {
  formatNumber,
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { AmountPanel, Skeleton } from "../../../../../ui/index";
import { useConfidentialTokenBalance } from "../../../../yield-entry/views";
import {
  useEarnEntry,
  useEarnTokenSelection,
} from "../../../react/use-earn-facades";
import { SelectToken } from "./select-token";

/** The Earn form's amount: the yield type's label, the amount and the token. */
export const SelectTokenSection = ({
  canSelectToken = true,
}: {
  canSelectToken?: boolean;
} = {}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

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

  const {
    submitted,
    errors: {
      stakeAmountGreaterThanAvailableAmount,
      stakeAmountGreaterThanMax,
      stakeAmountLessThanMin,
      stakeAmountIsZero,
    },
  } = validation;

  const min =
    stakeMinAmount === null
      ? null
      : `${t("shared.min")} ${formatTokenAmount(stakeMinAmount, locale, "up")} ${symbol}`;
  const max =
    stakeMaxAmount === null
      ? null
      : `${t("shared.max")} ${formatTokenAmount(stakeMaxAmount, locale, "down")} ${symbol}`;
  const limits = min && max ? `${min} / ${max}` : (min ?? max);
  const getError = () => {
    if (stakeAmountLessThanMin && limits) return limits;
    if (stakeAmountGreaterThanAvailableAmount) {
      return t("shared.insufficient_balance");
    }
    return undefined;
  };
  const error = getError();

  const balance = useConfidentialTokenBalance({
    balance: selectedTokenAvailableAmount
      ? {
          short: `${formatTokenAmount(selectedTokenAvailableAmount.amount, locale, "down")} ${selectedTokenAvailableAmount.symbol} ${t("shared.available")}`,
          full: `${formatNumber(selectedTokenAvailableAmount.amount, locale)} ${selectedTokenAvailableAmount.symbol} ${t("shared.available")}`,
          ...(stakeAmountGreaterThanAvailableAmount
            ? { tone: "danger" as const }
            : {}),
        }
      : null,
    hidden: view.hiddenTokenBalance,
    revealed: view.revealedTokenBalance,
    revealStatus: revealTokenBalanceStatus,
    onReveal: () => revealTokenBalance(undefined),
    onHide: () => hideTokenBalance(undefined),
    symbol,
  });

  if (appLoading || tokenSelection.isLoading) {
    return <Skeleton shape="rect" height="panel" />;
  }

  return (
    <AmountPanel
      label={
        view.selectedStake
          ? getYieldTypeLabels(view.selectedStake, t).title
          : t("shared.amount")
      }
      value={toAmountValue(stakeAmount)}
      onValueChange={(value) => setAmount(fromAmountValue(value))}
      separators={amountSeparators(locale)}
      token={<SelectToken canSelect={canSelectToken} />}
      fiatValue={priceUsd ? formatUsd(priceUsd, locale) : ""}
      {...(balance === undefined ? {} : { balance })}
      {...(limits ? { limits } : {})}
      {...(error === undefined ? {} : { error })}
      invalid={
        (submitted && stakeAmountIsZero) ||
        stakeAmountGreaterThanAvailableAmount ||
        stakeAmountGreaterThanMax ||
        stakeAmountLessThanMin
      }
      // A hidden balance has no known maximum yet.
      {...(isStakeTokenSameAsGasToken || view.hiddenTokenBalance
        ? {}
        : {
            max: {
              label: t("shared.max"),
              onClick: () => setMaxAmount(undefined),
            },
          })}
      testIds={{
        root: "stake-token-section",
        input: "number-input",
        max: "stake-token-section-max-button",
      }}
    />
  );
};
