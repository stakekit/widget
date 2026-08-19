import BigNumber from "bignumber.js";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { TronResource } from "../../../domain/action/tron-resource";
import { stakeTokenSameAsGasToken } from "../../../domain/earn/stake";
import {
  getExtendedYieldType,
  getYieldRewardTokens,
  isBittensorStaking,
} from "../../../domain/earn/yield";
import { getTokenPriceInUSD } from "../../../domain/finance/price";
import type { YieldId } from "../../../domain/identity/identifiers";
import { hasActivePositionForYield } from "../../../domain/portfolio/positions";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../resources/token-prices/index";
import { TrackingService } from "../../../services/tracking/tracking-service";
import { formatUsd } from "../../../shared/lib/formatters";
import {
  defaultFormattedNumber,
  formatNumber,
} from "../../../shared/lib/number-format";
import { makeYieldEntry } from "../../yield-entry/index";
import {
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  earnSelectionViewAtom,
  earnSelectionYieldOptionsViewAtom,
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
  const yieldOptions = get(earnSelectionYieldOptionsViewAtom);
  const input = get(earnPageInputAtom);
  const quote = get(earnPageQuoteAtom);
  const selection = get(earnPageSelectionAtom);
  const selectedYield = quote.selectedStake;
  const selectedTokenOption = selection.token;
  const selectedToken = quote.selectedToken;
  const selectedValidators = get(selectedEarnValidatorsAtom);
  const availableAmount = selectedTokenOption?.amount
    ? new BigNumber(selectedTokenOption.amount)
    : null;
  const tokenOptionsLoading =
    tokenOptions.waiting && tokenOptions.items.length === 0;
  const yieldLoading = status.loading.yields || yieldOptions.waiting;
  const appLoading = get(earnAppLoadingAtom).isLoading;
  const hasNoYields = status.empty.yields;
  const readiness = (() => {
    if (hasNoYields) return { _tag: "Blocked" } as const;
    if (appLoading) return { _tag: "Loading" } as const;
    if (status.isFetching) return { _tag: "Refreshing" } as const;
    if (!earnSelection.canSubmit) return { _tag: "Blocked" } as const;
    return { _tag: "Ready" } as const;
  })();
  const selectedYieldHasActivePosition = selectedYield
    ? hasActivePositionForYield(earnSelection.positions, selectedYield.id)
    : false;

  return {
    amountInitialization: "PreserveIntent",
    availableAmount,
    entry: {
      amount: quote.stakeAmount,
      selectedProviderYieldId: quote.selectedProviderYieldId,
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
  const pricesRequest = getTokensPricesRequest({
    token: selectedToken,
    yieldDto: selectedYield,
  });
  const prices = get(
    pricesAtom.foreground(new PricesKey({ request: pricesRequest }))
  ).pipe(AsyncResult.value, Option.getOrNull);
  const availableAmount = input.availableAmount;
  const symbol = selectedToken?.symbol ?? "";
  const selectedTokenAvailableAmount = availableAmount
    ? {
        amount: availableAmount,
        fullFormattedAmount: formatNumber(availableAmount),
        shortFormattedAmount: defaultFormattedNumber(availableAmount),
        symbol,
      }
    : null;
  const stakeMaxAmount =
    selectedYield && entry.constraints.maximum && !entry.constraints.forceMax
      ? entry.constraints.allowedMaximum.toNumber()
      : null;
  const stakeMinAmount =
    selectedYield &&
    entry.constraints.minimum &&
    !entry.constraints.forceMax &&
    entry.constraints.allowedMinimum.isGreaterThan(0)
      ? entry.constraints.allowedMinimum.toNumber()
      : null;

  return {
    appLoading: entry.appLoading,
    buttonDisabled:
      entry.connected &&
      (entry.isFetching ||
        !entry.canSubmit ||
        !entry.preparation ||
        entry.kyc.isBlocking),
    canSubmit: entry.canSubmit,
    connected: entry.connected,
    cta: entry.cta,
    estimatedRewards: entry.estimatedRewards,
    footerIsLoading: input.footerIsLoading,
    formattedPrice:
      prices && selectedToken && selectedYield
        ? formatUsd(
            getTokenPriceInUSD({
              amount: entry.amount,
              baseToken: selectedYield.token,
              pricePerShare: null,
              prices,
              token: selectedToken,
            })
          )
        : "",
    isFetching: entry.isFetching,
    isLedgerLiveAccountPlaceholder: entry.isLedgerAccountPlaceholder,
    isStakeTokenSameAsGasToken:
      selectedYield && selectedToken
        ? stakeTokenSameAsGasToken({
            stakeToken: selectedToken,
            yieldDto: selectedYield,
          })
        : false,
    kyc: entry.kyc,
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
    selectedProviderYieldId: input.entry.selectedProviderYieldId,
    selectedStake: selectedYield,
    selectedToken,
    selectedTokenAvailableAmount,
    selectedValidators,
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

export const setEarnAmountAtom = Atom.fnSync((amount: BigNumber, context) =>
  context.set(setEarnSelectionAmountAtom, amount.toString(10))
).pipe(Atom.withLabel("setEarnAmountAtom"));

export const selectEarnProviderAtom = Atom.fnSync(
  (providerYieldId: YieldId, context) =>
    context.set(selectEarnSelectionProviderAtom, providerYieldId)
).pipe(Atom.withLabel("selectEarnProviderAtom"));

export const selectEarnTronResourceAtom = Atom.fnSync(
  (tronResource: TronResource, context) =>
    context.set(selectEarnSelectionTronResourceAtom, tronResource)
).pipe(Atom.withLabel("selectEarnTronResourceAtom"));

export const setEarnMaxAmountAtom = appRuntime
  .fn((_input: undefined, context) => {
    const constraints = context(earnYieldEntry.viewAtom).constraints;
    context.set(
      setEarnSelectionMaxAmountAtom,
      constraints.allowedMaximum.toString(10)
    );
    return TrackingService.use((tracking) =>
      tracking.trackEvent("earnPageMaxClicked")
    );
  })
  .pipe(Atom.withLabel("setEarnMaxAmountAtom"));

export const refreshEarnKycAtom = earnYieldEntry.refreshKycAtom;
export const runEarnPrimaryActionAtom = earnYieldEntry.submitAtom;
