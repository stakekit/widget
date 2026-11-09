import { Effect, Equal, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { TronResource } from "../../../domain/action/tron-resource";
import {
  getExtendedYieldType,
  getYieldRewardTokens,
  isBittensorStaking,
} from "../../../domain/earn/yield";
import { getTokenPriceInUSD } from "../../../domain/finance/price";
import type { ProviderOption } from "../../../domain/identity/identifiers";
import { hasActivePositionForYield } from "../../../domain/portfolio/positions";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../resources/token-prices/index";
import { TrackingService } from "../../../services/tracking/tracking-service";
import {
  getNetworkFeeEstimate,
  getYieldEntryPriceToken,
  makeYieldEntry,
} from "../../yield-entry/index";
import { earnTokenBalanceAtom } from "./confidential";
import {
  earnSelectionProviderOptionsViewAtom,
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  earnSelectionViewAtom,
  selectEarnSelectionProviderAtom,
  selectEarnSelectionTronResourceAtom,
  setEarnSelectionAmountAtom,
  setEarnSelectionMaxAmountAtom,
} from "./earn-selection";
import { earnAppLoadingAtom } from "./page-status";
import {
  earnPageInputAtom,
  earnPageQuoteAtom,
  earnPageSelectionAtom,
  getEarnPageValidationKey,
} from "./page-workflow";
import { selectedEarnValidatorsAtom } from "./validator-selection";

const earnYieldEntryInputAtom = Atom.make((get) => {
  const earnSelection = get(earnSelectionViewAtom);
  const status = get(earnSelectionStatusViewAtom);
  const tokenOptions = get(earnSelectionTokenOptionsViewAtom);
  const input = get(earnPageInputAtom);
  const quote = get(earnPageQuoteAtom);
  const selection = get(earnPageSelectionAtom);
  const selectedYield = quote.selectedStake;
  const selectedTokenOption = selection.token;
  const selectedToken = quote.selectedToken;
  const selectedValidators = get(selectedEarnValidatorsAtom);
  const tokenBalance = get(earnTokenBalanceAtom);
  const tokenOptionsLoading =
    tokenOptions.waiting && tokenOptions.items.length === 0;
  const yieldLoading = status.loading.yields;
  const appStatus = get(earnAppLoadingAtom);
  const appLoading = appStatus.isLoading;
  const hasNoYields = status.empty.yields;
  const readiness = (() => {
    if (hasNoYields) return { _tag: "Blocked" } as const;
    if (appLoading) return { _tag: "Loading" } as const;
    if (status.isFetching || appStatus.isRefreshing) {
      return { _tag: "Refreshing" } as const;
    }
    if (!earnSelection.canSubmit) return { _tag: "Blocked" } as const;
    return { _tag: "Ready" } as const;
  })();
  const selectedYieldHasActivePosition = selectedYield
    ? hasActivePositionForYield(earnSelection.positions, selectedYield.id)
    : false;

  return {
    amountEntered: input.amountTouched,
    /** The amount as typed, a decimal string; `""` for none. */
    amountValue: input.stakeAmount,
    amountInitialization: "PreserveIntent",
    availableAmount: tokenBalance.availableAmount,
    hiddenTokenBalance: tokenBalance.hiddenTokenBalance,
    revealedTokenBalance: tokenBalance.revealedTokenBalance,
    entry: {
      amount: quote.stakeAmount,
      selectedProviderOption: quote.selectedProviderOption,
      token: selectedToken,
      tronResource: input.tronResource,
      useMaxAmount: input.useMaxAmount,
      validators: selectedValidators,
      yield: selectedYield,
    },
    footerIsLoading: tokenOptionsLoading || yieldLoading,
    hasNoYields,
    mount: { _tag: "Earn" },
    readiness,
    selectedTokenOption,
    selectedYieldHasActivePosition,
    validationKey: getEarnPageValidationKey(selection),
  } as const;
}).pipe(Atom.withLabel("earnYieldEntryInputAtom"));

const earnYieldEntry = makeYieldEntry(earnYieldEntryInputAtom);

export const earnEntryViewAtom = Atom.make((get) => {
  const input = get(earnYieldEntryInputAtom);
  const entry = get(earnYieldEntry.viewAtom);
  const selectedYield = input.entry.yield;
  const selectedToken = input.entry.token;
  const selectedValidators = input.entry.validators;
  const priceToken = getYieldEntryPriceToken(selectedYield, selectedToken);
  const pricesRequest = getTokensPricesRequest({
    token: priceToken,
    yieldDto: selectedYield,
  });
  const prices = get(
    pricesAtom.foreground(new PricesKey({ request: pricesRequest }))
  ).pipe(AsyncResult.value, Option.getOrNull);
  const availableAmount = input.availableAmount;
  const symbol = selectedToken?.symbol ?? "";
  const selectedTokenAvailableAmount =
    availableAmount !== null
      ? {
          amount: availableAmount,
          symbol,
        }
      : null;
  const stakeMaxAmount =
    selectedYield && entry.constraints.maximum && !entry.constraints.forceMax
      ? entry.constraints.allowedMaximum
      : null;
  const stakeMinAmount =
    selectedYield &&
    entry.constraints.minimum &&
    !entry.constraints.forceMax &&
    entry.constraints.allowedMinimum.isGreaterThan(0)
      ? entry.constraints.allowedMinimum
      : null;

  return {
    /** The user entered an amount, or the yield forces the balance. */
    amountEntered: input.amountEntered,
    appLoading: entry.appLoading,
    /** Why the balance cannot fund any entry, known before typing. */
    balanceWarning: entry.balanceWarning,
    buttonDisabled:
      entry.connected &&
      (entry.isFetching ||
        !entry.canSubmit ||
        !entry.preparation ||
        entry.kyc.isBlocking),
    canSubmit: entry.canSubmit,
    // A hidden balance has no known maximum yet; a gas token one waits for
    // the gas Max must leave.
    canFillMax: !input.hiddenTokenBalance && entry.maxAmount !== null,
    /** Max has nothing to fill, such as a balance the gas would use up. */
    maxFillsNothing: entry.maxAmount?.isZero() ?? false,
    connected: entry.connected,
    cta: entry.cta,
    estimatedRewards: entry.estimatedRewards,
    footerIsLoading: input.footerIsLoading,
    hiddenTokenBalance: input.hiddenTokenBalance,
    revealedTokenBalance: input.revealedTokenBalance,
    priceUsd:
      prices && priceToken && selectedYield
        ? getTokenPriceInUSD({
            amount: entry.amount,
            baseToken: selectedYield.token,
            pricePerShare: null,
            prices,
            token: priceToken,
          })
        : null,
    isFetching: entry.isFetching,
    isLedgerLiveAccountPlaceholder: entry.isLedgerAccountPlaceholder,
    kyc: entry.kyc,
    maxGasReserveNote: entry.maxGasReserveNote,
    networkFee: getNetworkFeeEstimate({
      connected: entry.connected,
      hidden: entry.gasFeeHidden,
      pending: entry.networkFeePending,
      prices,
      simulation: entry.networkFeeSimulation,
    }),
    pointsRewardTokens: selectedYield
      ? getYieldRewardTokens(selectedYield).filter((token) => token.isPoints)
      : null,
    rewardsTokenSymbol:
      selectedYield && isBittensorStaking(selectedYield.id)
        ? ([...selectedValidators.values()][0]?.subnet?.tokenSymbol ?? symbol)
        : symbol,
    preparation: entry.preparation,
    providers: entry.providers,
    rewardToken: entry.rewardToken,
    selectedStake: selectedYield,
    selectedToken,
    selectedTokenAvailableAmount,
    selectedValidators,
    amountValue: input.amountValue,
    stakeAmount: entry.amount,
    stakeMaxAmount,
    stakeMinAmount,
    symbol,
    tronResource: input.entry.tronResource,
    validation: entry.validation,
    walletScope: entry.walletScope,
    yieldType: selectedYield ? getExtendedYieldType(selectedYield) : null,
  } as const;
}).pipe(Atom.withLabel("earnEntryViewAtom"));

/**
 * What the Dashboard details pane describes of the Earn form: its yield,
 * validators and providers. Typing an amount leaves it equal, so the pane and
 * its charts do not render again per keystroke.
 */
export const earnDetailsViewAtom = Atom.make((get) => {
  const { appLoading, providers, selectedStake, selectedValidators } =
    get(earnEntryViewAtom);
  return { appLoading, providers, selectedStake, selectedValidators } as const;
}).pipe(Atom.withEquality(Equal.equals), Atom.withLabel("earnDetailsViewAtom"));

/** Takes the amount input's decimal string, `""` once cleared. */
export const setEarnAmountAtom = Atom.fnSync((amount: string, context) =>
  context.set(setEarnSelectionAmountAtom, amount)
).pipe(Atom.withLabel("setEarnAmountAtom"));

export const earnProviderOptionsViewAtom = Atom.make((get) => ({
  ...get(earnSelectionProviderOptionsViewAtom),
  appLoading: get(earnAppLoadingAtom).isLoading,
})).pipe(
  Atom.withEquality(Equal.equals),
  Atom.withLabel("earnProviderOptionsViewAtom")
);

export const selectEarnProviderOptionAtom = Atom.fnSync(
  (providerOption: ProviderOption, context) =>
    context.set(selectEarnSelectionProviderAtom, providerOption)
).pipe(Atom.withLabel("selectEarnProviderOptionAtom"));

export const selectEarnTronResourceAtom = Atom.fnSync(
  (tronResource: TronResource, context) =>
    context.set(selectEarnSelectionTronResourceAtom, tronResource)
).pipe(Atom.withLabel("selectEarnTronResourceAtom"));

export const setEarnMaxAmountAtom = appRuntime
  .fn((_input: undefined, context) => {
    const { maxAmount } = context(earnYieldEntry.viewAtom);
    if (maxAmount === null) return Effect.void;
    context.set(setEarnSelectionMaxAmountAtom, maxAmount.toString(10));
    return TrackingService.use((tracking) =>
      tracking.trackEvent("earnPageMaxClicked")
    );
  })
  .pipe(Atom.withLabel("setEarnMaxAmountAtom"));

export const refreshEarnKycAtom = earnYieldEntry.refreshKycAtom;
export const runEarnPrimaryActionAtom = earnYieldEntry.submitAtom;
