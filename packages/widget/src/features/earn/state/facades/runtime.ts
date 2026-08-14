import BigNumber from "bignumber.js";
import { Effect, Match, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../../app/runtime/app-runtime";
import { widgetConfigAtom } from "../../../../app/runtime/widget-config";
import { stakeTokenSameAsGasToken } from "../../../../domain";
import type { TronResource } from "../../../../domain/action/tron-resource";
import { getKycProviderName } from "../../../../domain/earn/kyc";
import type {
  EarnValidator,
  EarnValidatorKey,
  EarnYieldWithProvider,
} from "../../../../domain/earn/models";
import {
  getDashboardYieldCategory,
  getExtendedYieldType,
  getYieldRewardTokens,
  getYieldTypesSortRank,
  isBittensorStaking,
} from "../../../../domain/earn/yield";
import { getTokenPriceInUSD } from "../../../../domain/finance/price";
import type { YieldId } from "../../../../domain/identity/identifiers";
import { tokenString } from "../../../../domain/token/token";
import type { DashboardYieldCategory } from "../../../../public-api/types";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../../resources/token-prices/prices";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import { walletCommandIdentity } from "../../../../services/wallet/wallet-scope";
import { formatUsd } from "../../../../shared/lib/formatters";
import {
  defaultFormattedNumber,
  formatNumber,
} from "../../../../shared/lib/number-format";
import {
  isMountAnimationFinished,
  mountAnimationStateAtom,
} from "../../../mount-animation/state";
import {
  walletConfigResultAtom,
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../../wallet/state";
import {
  getYieldAmountConstraints,
  makeYieldEntry,
} from "../../../yield-entry/state";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  makeYieldSummary,
  refreshCurrentYieldKycAtom,
} from "../../../yield-summary/state";
import {
  type EarnTokenOption,
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  earnSelectionValidatorOptionsViewAtom,
  earnSelectionViewAtom,
  earnSelectionYieldOptionsViewAtom,
  loadMoreEarnSelectionTokensAtom,
  loadMoreEarnSelectionValidatorsAtom,
  removeEarnSelectionValidatorAtom,
  retryEarnSelectionAtom,
  selectEarnSelectionCategoryAtom,
  selectEarnSelectionProviderAtom,
  selectEarnSelectionTokenAtom,
  selectEarnSelectionTronResourceAtom,
  selectEarnSelectionValidatorAtom,
  selectEarnSelectionYieldAtom,
  setEarnSelectionAmountAtom,
  setEarnSelectionMaxAmountAtom,
  setEarnSelectionValidatorSearchAtom,
} from "../earn-selection";
import {
  earnPageInputAtom,
  earnPageQuoteAtom,
  earnPageSearchAtom,
  earnPageSelectionAtom,
  getEarnPageValidationKey,
} from "../page-workflow";
import { pendingActionDeepLinkViewAtom } from "../pending-action-deep-link";

const selectedValidatorsAtom = Atom.make(
  (get) =>
    new Map(
      get(earnPageSelectionAtom).validators.map((validator) => [
        validator.key,
        validator,
      ])
    )
).pipe(Atom.withLabel("selectedEarnValidatorsAtom"));

const earnAppLoadingAtom = Atom.make((get) => {
  const selectedToken = get(earnPageQuoteAtom).selectedToken;
  const wallet = get(walletConnectionStateAtom);
  const walletConfig = get(walletConfigResultAtom);
  const presentationFrozen = !isMountAnimationFinished(
    get(mountAnimationStateAtom)
  );

  return {
    isLoading:
      !selectedToken ||
      AsyncResult.isInitial(walletConfig) ||
      walletConfig.waiting ||
      AsyncResult.isInitial(get(pendingActionDeepLinkViewAtom)) ||
      wallet.status === "connecting",
    presentationFrozen,
  } as const;
}).pipe(Atom.withLabel("earnAppLoadingAtom"));

const yieldSummaryInputAtom = Atom.make((get) => {
  const quote = get(earnPageQuoteAtom);
  return {
    selectedProviderYieldId: quote.selectedProviderYieldId,
    validators: get(selectedValidatorsAtom),
    yield: quote.selectedStake,
  };
}).pipe(Atom.withLabel("earnYieldSummaryInputAtom"));

const earnYieldSummary = makeYieldSummary(yieldSummaryInputAtom);

export const earnTokenSelectionViewAtom = Atom.make((get) => {
  const options = get(earnSelectionTokenOptionsViewAtom);
  const status = get(earnSelectionStatusViewAtom).status;
  const search = get(earnPageSearchAtom).token;
  const all = [...options.items];
  const normalizedSearch = search.toLowerCase();
  const filtered = normalizedSearch
    ? all.filter(
        (option) =>
          option.token.name.toLowerCase().includes(normalizedSearch) ||
          option.token.symbol.toLowerCase().includes(normalizedSearch)
      )
    : all;
  const loading =
    status === "resolving-wallet" ||
    status === "loading-token-options" ||
    status === "loading-initial-selection" ||
    (options.waiting && all.length === 0);

  return {
    all,
    filtered,
    hasMore: options.page.hasMore,
    isLoading: loading,
    isLoadingMore: options.page.isLoadingMore,
    search,
    selected: options.selected,
  } as const;
}).pipe(Atom.withLabel("earnTokenSelectionViewAtom"));

export const setEarnTokenSearchAtom = Atom.fnSync((token: string, context) => {
  const search = context(earnPageSearchAtom);
  context.set(earnPageSearchAtom, { ...search, token });
}).pipe(Atom.withLabel("setEarnTokenSearchAtom"));

export const selectEarnTokenAtom = appRuntime
  .fn((token: EarnTokenOption, context) => {
    context.set(selectEarnSelectionTokenAtom, tokenString(token.token));
    return TrackingService.use((tracking) =>
      tracking.trackEvent("tokenSelected", { token: token.token.symbol })
    );
  })
  .pipe(Atom.withLabel("selectEarnTokenAtom"));

export const loadMoreEarnTokensAtom = loadMoreEarnSelectionTokensAtom;

const groupYields = (items: ReadonlyArray<EarnYieldWithProvider>) => {
  const groups = new Map<
    ReturnType<typeof getExtendedYieldType>,
    {
      readonly itemsLength: number;
      readonly type: ReturnType<typeof getExtendedYieldType>;
    }
  >();
  for (const item of items) {
    const type = getExtendedYieldType(item);
    groups.set(type, {
      itemsLength: (groups.get(type)?.itemsLength ?? 0) + 1,
      type,
    });
  }
  return [...groups.values()];
};

const resolveValidatorsData = ({
  enabled,
  shouldSort,
  validators,
}: {
  readonly enabled: boolean;
  readonly shouldSort: boolean;
  readonly validators: ReadonlyArray<EarnValidator>;
}) => {
  if (!enabled) return null;
  if (!shouldSort) return [...validators];
  return [...validators].sort(
    (left, right) =>
      (right.rewardRate?.total ?? 0) - (left.rewardRate?.total ?? 0)
  );
};

export const earnYieldSelectionViewAtom = Atom.make((get) => {
  const config = get(widgetConfigAtom);
  const status = get(earnSelectionStatusViewAtom).status;
  const tokenOptions = get(earnSelectionTokenOptionsViewAtom);
  const yieldOptions = get(earnSelectionYieldOptionsViewAtom);
  const selected = yieldOptions.selected;
  const availableYields = yieldOptions.items;
  const combined =
    selected && !availableYields.some((item) => item.id === selected.id)
      ? [selected, ...availableYields]
      : [...availableYields];
  const all = combined.sort(
    (left, right) => right.rewardRate.total - left.rewardRate.total
  );
  const search = get(earnPageSearchAtom).stake;
  const normalizedSearch = search.toLowerCase();
  const searchFiltered = normalizedSearch
    ? all.filter(
        (item) =>
          item.token.name.toLowerCase().includes(normalizedSearch) ||
          item.token.symbol.toLowerCase().includes(normalizedSearch) ||
          item.metadata.name.toLowerCase().includes(normalizedSearch) ||
          getYieldRewardTokens(item).some(
            (rewardToken) =>
              rewardToken.name.toLowerCase().includes(normalizedSearch) ||
              rewardToken.symbol.toLowerCase().includes(normalizedSearch)
          )
      )
    : all;
  const categoryGrouping =
    config.dashboardVariant && config.yieldGrouping === "category";
  const category = yieldOptions.selectedCategory;
  const categoryFiltered =
    categoryGrouping && category
      ? searchFiltered.filter(
          (item) => getDashboardYieldCategory(item) === category
        )
      : searchFiltered;
  const filtered = [...categoryFiltered].sort(
    (left, right) => getYieldTypesSortRank(left) - getYieldTypesSortRank(right)
  );
  const tokenOptionsLoading =
    tokenOptions.waiting && tokenOptions.items.length === 0;
  const yieldLoading = status === "loading-yields" || yieldOptions.waiting;

  return {
    all,
    availableCategories: categoryGrouping
      ? [...yieldOptions.availableCategories]
      : [],
    filtered,
    groups: groupYields(filtered),
    isLoading:
      status === "resolving-wallet" ||
      status === "loading-initial-selection" ||
      yieldLoading ||
      tokenOptionsLoading,
    search,
    selected,
    selectedCategory: category,
  } as const;
}).pipe(Atom.withLabel("earnYieldSelectionViewAtom"));

export const setEarnYieldSearchAtom = Atom.fnSync((stake: string, context) => {
  const search = context(earnPageSearchAtom);
  context.set(earnPageSearchAtom, { ...search, stake });
}).pipe(Atom.withLabel("setEarnYieldSearchAtom"));

export const selectEarnYieldAtom = Atom.fnSync((yieldId: YieldId, context) =>
  context.set(selectEarnSelectionYieldAtom, yieldId)
).pipe(Atom.withLabel("selectEarnYieldAtom"));

export const selectEarnCategoryAtom = Atom.fnSync(
  (category: DashboardYieldCategory, context) =>
    context.set(selectEarnSelectionCategoryAtom, category)
).pipe(Atom.withLabel("selectEarnCategoryAtom"));

export const earnValidatorSelectionViewAtom = Atom.make((get) => {
  const config = get(widgetConfigAtom);
  const status = get(earnSelectionStatusViewAtom).status;
  const tokenOptions = get(earnSelectionTokenOptionsViewAtom);
  const validatorOptions = get(earnSelectionValidatorOptionsViewAtom);
  const yieldOptions = get(earnSelectionYieldOptionsViewAtom);
  const data = resolveValidatorsData({
    enabled: Boolean(
      validatorOptions.selectedYield && validatorOptions.enabled
    ),
    shouldSort:
      Boolean(config.dashboardVariant) ||
      config.variant === "utila" ||
      config.variant === "porto",
    validators: validatorOptions.items,
  });
  const tokenOptionsLoading =
    tokenOptions.waiting && tokenOptions.items.length === 0;
  const yieldLoading = status === "loading-yields" || yieldOptions.waiting;

  return {
    data,
    hasMore: validatorOptions.page.hasMore,
    isDebouncing: validatorOptions.isDebouncing,
    isLoading:
      get(earnAppLoadingAtom).isLoading ||
      tokenOptionsLoading ||
      yieldLoading ||
      validatorOptions.isDebouncing ||
      (validatorOptions.enabled && validatorOptions.page.isLoadingFirstPage),
    isLoadingMore: validatorOptions.page.isLoadingMore,
    search: validatorOptions.search,
    selected: get(selectedValidatorsAtom),
    selectedYield: validatorOptions.selectedYield,
  } as const;
}).pipe(Atom.withLabel("earnValidatorSelectionViewAtom"));

type EarnValidatorModalEvent =
  | Readonly<{ readonly _tag: "Opened" }>
  | Readonly<{ readonly _tag: "Closed" }>
  | Readonly<{ readonly _tag: "ViewMoreClicked" }>;

export const earnValidatorModalEventAtom = appRuntime
  .fn((event: EarnValidatorModalEvent) => {
    const trackingEvent = Match.value(event).pipe(
      Match.tag("Opened", () => "selectValidatorModalOpened" as const),
      Match.tag("Closed", () => "selectValidatorModalClosed" as const),
      Match.tag(
        "ViewMoreClicked",
        () => "selectValidatorViewMoreClicked" as const
      ),
      Match.exhaustive
    );
    return TrackingService.use((tracking) =>
      tracking.trackEvent(trackingEvent)
    );
  })
  .pipe(Atom.withLabel("earnValidatorModalEventAtom"));

export const setEarnValidatorSearchAtom = setEarnSelectionValidatorSearchAtom;

export const selectEarnValidatorAtom = appRuntime
  .fn((validatorKey: EarnValidatorKey, context) => {
    const view = context(earnSelectionValidatorOptionsViewAtom);
    const validator = view.items.find(
      (candidate) => candidate.key === validatorKey
    );
    if (!view.selectedYield || !validator) return Effect.void;
    context.set(selectEarnSelectionValidatorAtom, validator.key);
    return TrackingService.use((tracking) =>
      tracking.trackEvent("validatorSelected", {
        validatorName: validator.name,
        validatorAddress: validator.address,
      })
    );
  })
  .pipe(Atom.withLabel("selectEarnValidatorAtom"));

export const removeEarnValidatorAtom = appRuntime
  .fn((validatorKey: EarnValidatorKey, context) => {
    const view = context(earnSelectionValidatorOptionsViewAtom);
    const validator = [...view.selected, ...view.items].find(
      (candidate) => candidate.key === validatorKey
    );
    if (!validator) return Effect.void;
    context.set(removeEarnSelectionValidatorAtom, validatorKey);
    return TrackingService.use((tracking) =>
      tracking.trackEvent("validatorRemoved", {
        validatorName: validator.name,
        validatorAddress: validator.address,
      })
    );
  })
  .pipe(Atom.withLabel("removeEarnValidatorAtom"));

export const loadMoreEarnValidatorsAtom = loadMoreEarnSelectionValidatorsAtom;

const earnYieldEntryInputAtom = Atom.make((get) => {
  const config = get(widgetConfigAtom);
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
  const selectedValidators = get(selectedValidatorsAtom);
  const wallet = get(walletConnectionStateAtom);
  const walletScope = get(walletScopeAtom);
  const summary = get(earnYieldSummary.viewAtom);
  const availableAmount = selectedTokenOption
    ? new BigNumber(selectedTokenOption.amount)
    : null;
  const connected = wallet.status === "connected";
  const kyc = get(
    currentYieldKycGateAtom(
      new CurrentYieldKycGateKey({ enabled: true, yieldDto: selectedYield })
    )
  );
  const tokenOptionsLoading =
    tokenOptions.waiting && tokenOptions.items.length === 0;
  const yieldLoading =
    status.status === "loading-yields" || yieldOptions.waiting;

  return {
    availableAmount,
    canSubmit: earnSelection.canSubmit,
    connected,
    defaultToMinimum: false,
    entry: {
      amount: quote.stakeAmount,
      selectedProviderYieldId: quote.selectedProviderYieldId,
      token: selectedToken,
      tronResource: input.tronResource,
      useMaxAmount: input.useMaxAmount,
      validators: selectedValidators,
      yield: selectedYield,
    },
    externalProviders: Boolean(config.externalProviders),
    footerIsLoading: tokenOptionsLoading || yieldLoading,
    hasNoYields: status.status === "no-yields",
    isAppLoading: get(earnAppLoadingAtom).isLoading,
    isFetching: status.isFetching,
    isKycBlocking: kyc.isBlocking,
    isKycLoading: kyc.isLoading,
    isLedgerAccountPlaceholder:
      connected && wallet.isLedgerLiveAccountPlaceholder,
    isWalletConnecting: wallet.status === "connecting",
    mount: { _tag: "Earn" },
    kyc,
    positionsData: earnSelection.positions,
    providers: summary.providers,
    selectedTokenOption,
    validationKey: getEarnPageValidationKey(selection),
    validateAmount: connected,
    wallet: {
      additionalAddresses: connected ? wallet.additionalAddresses : null,
      address: connected ? wallet.address : null,
      isLedgerLive: wallet.isLedgerLive,
    },
    walletCommandIdentity: walletCommandIdentity(wallet),
    walletScope,
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
    appLoading: input.isAppLoading,
    buttonDisabled:
      input.connected &&
      (input.isFetching ||
        !input.canSubmit ||
        !entry.preparation ||
        input.isKycBlocking),
    canSubmit: input.canSubmit,
    connected: input.connected,
    cta: entry.cta,
    estimatedRewards: entry.estimatedRewards,
    footerIsLoading: input.footerIsLoading,
    formattedPrice:
      prices && selectedToken && selectedYield
        ? formatUsd(
            getTokenPriceInUSD({
              amount: input.entry.amount,
              baseToken: selectedYield.token,
              pricePerShare: null,
              prices,
              token: selectedToken,
            })
          )
        : "",
    isFetching: input.isFetching,
    isLedgerLiveAccountPlaceholder: input.isLedgerAccountPlaceholder,
    isStakeTokenSameAsGasToken:
      selectedYield && selectedToken
        ? stakeTokenSameAsGasToken({
            stakeToken: selectedToken,
            yieldDto: selectedYield,
          })
        : false,
    kyc: {
      gate: input.kyc.gate,
      isBlocking: input.kyc.isBlocking,
      isChecking: input.kyc.isChecking,
      providerName: getKycProviderName(selectedYield),
    },
    pointsRewardTokens: selectedYield
      ? getYieldRewardTokens(selectedYield).filter((token) => token.isPoints)
      : null,
    rewardsTokenSymbol:
      selectedYield && isBittensorStaking(selectedYield.id)
        ? ([...selectedValidators.values()][0]?.subnet?.tokenSymbol ?? symbol)
        : symbol,
    preparation: entry.preparation,
    providers: input.providers,
    rewardToken: get(earnYieldSummary.viewAtom).rewardToken,
    selectedProviderYieldId: input.entry.selectedProviderYieldId,
    selectedStake: selectedYield,
    selectedToken,
    selectedTokenAvailableAmount,
    selectedValidators,
    stakeAmount: input.entry.amount,
    stakeMaxAmount,
    stakeMinAmount,
    symbol,
    tronResource: input.entry.tronResource,
    validation: entry.validation,
    walletScope: input.walletScope,
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
    const constraints = getYieldAmountConstraints({
      type: "enter",
      availableAmount:
        context(earnEntryViewAtom).selectedTokenAvailableAmount?.amount ?? null,
      positionsData: context(earnSelectionViewAtom).positions,
      yield: context(earnEntryViewAtom).selectedStake,
    });
    context.set(
      setEarnSelectionMaxAmountAtom,
      constraints.allowedMaximum.toString(10)
    );
    return TrackingService.use((tracking) =>
      tracking.trackEvent("earnPageMaxClicked")
    );
  })
  .pipe(Atom.withLabel("setEarnMaxAmountAtom"));

export const refreshEarnKycAtom = Atom.fnSync(
  (_input: undefined, context) => {
    context.set(
      refreshCurrentYieldKycAtom(
        new CurrentYieldKycGateKey({
          enabled: true,
          yieldDto: context(earnYieldEntryInputAtom).entry.yield,
        })
      ),
      undefined
    );
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("refreshEarnKycAtom"));

export const retryEarnPageAtom = retryEarnSelectionAtom;

export const earnPageStatusViewAtom = Atom.make((get) => {
  const status = get(earnSelectionStatusViewAtom);
  return {
    canRetry: status.canRetry,
    hasNoYields: status.status === "no-yields",
    isError: status.status === "failed",
    machineStatus: status.status,
    presentationFrozen: get(earnAppLoadingAtom).presentationFrozen,
  } as const;
}).pipe(Atom.withLabel("earnPageStatusViewAtom"));

export const runEarnPrimaryActionAtom = earnYieldEntry.submitAtom;
