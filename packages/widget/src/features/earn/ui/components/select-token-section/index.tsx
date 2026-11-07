import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import {
  type ExtendedYieldType,
  getYieldTypeLabels,
  isDepositYieldType,
} from "../../../../../domain/earn/yield";
import { amountSeparators } from "../../../../../shared/lib/amount-value";
import {
  formatNumber,
  formatTokenAmount,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { AmountPanel } from "../../../../../ui/index";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import {
  useNetworkFeeNotes,
  type YieldEntryBalanceWarning,
} from "../../../../yield-entry/index";
import { useConfidentialTokenBalance } from "../../../../yield-entry/views";
import {
  useEarnEntry,
  useEarnTokenSelection,
} from "../../../react/use-earn-facades";
import { AmountPanelSkeleton } from "../earn-form-skeleton";
import { SelectToken } from "./select-token";

/** What is wrong with the amount, said at the start of the line under it. */
type AmountMessage = {
  readonly error?: string;
  readonly warning?: string;
};

/**
 * The one message the amount shows: an error once an amount is typed that
 * cannot be used, or before any is typed, a warning when the balance cannot
 * fund one. A minimum the balance itself misses is said the same way typed or
 * not, so Max filling too little says why.
 */
const getAmountMessage = ({
  amountTyped,
  balanceWarning,
  errors,
  locale,
  maximum,
  minimum,
  symbol,
  t,
  yieldType,
}: {
  readonly amountTyped: boolean;
  readonly balanceWarning: YieldEntryBalanceWarning | null;
  readonly errors: {
    readonly stakeAmountGreaterThanAvailableAmount: boolean;
    readonly stakeAmountGreaterThanMax: boolean;
    readonly stakeAmountLessThanMin: boolean;
  };
  readonly locale: string;
  readonly maximum: BigNumber | null;
  readonly minimum: BigNumber | null;
  readonly symbol: string;
  readonly t: TFunction;
  readonly yieldType: ExtendedYieldType | null;
}): AmountMessage => {
  const context =
    yieldType && isDepositYieldType(yieldType) ? { context: "deposit" } : {};
  const balanceMessage = (() => {
    if (!balanceWarning) return null;
    if (balanceWarning._tag === "NoBalance") {
      return t("details.amount_error.no_balance", { ...context, symbol });
    }
    return t("details.amount_error.balance_below_minimum", {
      ...context,
      amount: formatTokenAmount(balanceWarning.minimum, locale, "up"),
      symbol,
    });
  })();

  if (!amountTyped) return balanceMessage ? { warning: balanceMessage } : {};
  if (errors.stakeAmountGreaterThanAvailableAmount) {
    return { error: t("shared.insufficient_balance") };
  }
  if (errors.stakeAmountGreaterThanMax && maximum) {
    return {
      error: t("details.amount_error.above_maximum", {
        amount: formatTokenAmount(maximum, locale, "down"),
        symbol,
      }),
    };
  }
  if (errors.stakeAmountLessThanMin) {
    if (balanceMessage) return { error: balanceMessage };
    if (minimum) {
      return {
        error: t("details.amount_error.below_minimum", {
          amount: formatTokenAmount(minimum, locale, "up"),
          symbol,
        }),
      };
    }
  }
  return {};
};

/** The Earn form's amount: the yield type's label, the amount and the token. */
export const SelectTokenSection = ({
  canSelectToken = true,
}: {
  canSelectToken?: boolean;
} = {}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const disableResizingInputFontSize = useWidgetConfig(
    "disableResizingInputFontSize"
  );
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
    balanceWarning,
    selectedTokenAvailableAmount,
    priceUsd,
    amountValue,
    validation,
    stakeMaxAmount,
    stakeMinAmount,
    symbol,
    canFillMax,
    maxFillsNothing,
    maxGasReserveNote,
    networkFee,
  } = view;

  const min =
    stakeMinAmount === null
      ? null
      : `${t("shared.min")} ${formatTokenAmount(stakeMinAmount, locale, "up")} ${symbol}`;
  const max =
    stakeMaxAmount === null
      ? null
      : `${t("shared.max")} ${formatTokenAmount(stakeMaxAmount, locale, "down")} ${symbol}`;
  // The limits stay the helper at the end of the line; what is wrong is said
  // at its start.
  const limits = min && max ? `${min} / ${max}` : (min ?? max);
  const message = getAmountMessage({
    amountTyped: amountValue !== "",
    balanceWarning,
    errors: validation.errors,
    locale,
    maximum: stakeMaxAmount,
    minimum: stakeMinAmount,
    symbol,
    t,
    yieldType: view.yieldType,
  });
  // An empty amount is worth nothing; an amount without a price has no
  // value to show.
  const getFiatValue = () => {
    if (amountValue === "") return formatUsd(0, locale);
    return priceUsd ? formatUsd(priceUsd, locale) : "";
  };
  const fillMax = () => setMaxAmount(undefined);

  const balance = useConfidentialTokenBalance({
    balance: selectedTokenAvailableAmount
      ? {
          short: `${formatTokenAmount(selectedTokenAvailableAmount.amount, locale, "down")} ${selectedTokenAvailableAmount.symbol} ${t("shared.available")}`,
          // Zerion fills in the maximum from a tap on the balance.
          ...(earnPresentation.zerion && canFillMax && !maxFillsNothing
            ? { fill: { label: t("shared.max"), onClick: fillMax } }
            : {
                full: `${formatNumber(selectedTokenAvailableAmount.amount, locale)} ${selectedTokenAvailableAmount.symbol} ${t("shared.available")}`,
              }),
        }
      : null,
    hidden: view.hiddenTokenBalance,
    revealed: view.revealedTokenBalance,
    revealStatus: revealTokenBalanceStatus,
    onReveal: () => revealTokenBalance(undefined),
    onHide: () => hideTokenBalance(undefined),
    symbol,
  });
  const notes = useNetworkFeeNotes({
    fee: networkFee,
    maxGasReserve: maxGasReserveNote,
  });

  if (appLoading || tokenSelection.isLoading) return <AmountPanelSkeleton />;

  return (
    <AmountPanel
      shrink={!disableResizingInputFontSize}
      // The amount's title above its card; Zerion names it inside.
      labelPlacement={earnPresentation.zerion ? "inside" : "above"}
      // The yield type names the amount; while a yield resolves, such as
      // across a category switch, a placeholder holds the title.
      labelPending={view.selectedStake === null}
      label={
        view.selectedStake
          ? getYieldTypeLabels(view.selectedStake, t).title
          : t("shared.amount")
      }
      value={amountValue}
      onValueChange={setAmount}
      separators={amountSeparators(locale)}
      token={<SelectToken canSelect={canSelectToken} />}
      fiatValue={getFiatValue()}
      {...(balance === undefined ? {} : { balance })}
      {...(limits ? { limits } : {})}
      {...message}
      invalid={validation.submitted && validation.errors.stakeAmountIsZero}
      {...(canFillMax
        ? {
            max: {
              label: t("shared.max"),
              onClick: fillMax,
              // Nothing to fill, such as from an empty balance.
              disabled: maxFillsNothing,
            },
          }
        : {})}
      notes={notes}
      testIds={{
        root: "stake-token-section",
        input: "number-input",
        max: "stake-token-section-max-button",
      }}
    />
  );
};
