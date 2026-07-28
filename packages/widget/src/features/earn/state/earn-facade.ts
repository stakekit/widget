import BigNumber from "bignumber.js";
import { Duration, Effect, Match, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetConfigAtom } from "../../../app/config/settings";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { stakeTokenSameAsGasToken } from "../../../domain";
import type {
  EarnValidator,
  EarnValidatorKey,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { YieldId } from "../../../domain/schema/identifiers";
import type { TronResource } from "../../../domain/schema/legacy-models";
import { getKycProviderName } from "../../../domain/types/kyc";
import { getTokenPriceInUSD } from "../../../domain/types/price";
import { tokenString } from "../../../domain/types/tokens";
import {
  getDashboardYieldCategory,
  getExtendedYieldType,
  getYieldRewardTokens,
  getYieldTypesSortRank,
  isBittensorStaking,
  isYieldActionArgRequired,
} from "../../../domain/types/yields";
import type { DashboardYieldCategory } from "../../../public-api/types";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../resources/token-prices/prices";
import { TrackingService } from "../../../services/tracking/tracking-service";
import { isLedgerLiveConnector } from "../../../services/wallet/connectors/ledger/ledger-live-connector-meta";
import { formatUsd } from "../../../shared/lib/formatters";
import {
  defaultFormattedNumber,
  formatNumber,
} from "../../../shared/lib/number-format";
import { makeClassicTransactionFlowDestination } from "../../classic-transaction-flow/state";
import {
  isMountAnimationFinished,
  mountAnimationStateAtom,
} from "../../mount-animation/state";
import {
  runAddLedgerAccount,
  walletConfigResultAtom,
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../wallet/state";
import {
  getYieldAmountConstraints,
  makeYieldEntry,
} from "../../yield-entry/state";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  makeYieldSummary,
  refreshCurrentYieldKycAtom,
} from "../../yield-summary/state";
import {
  earnMachineIntentAtom,
  earnMachineViewAtom,
} from "./atoms-state/machine/atoms";
import {
  earnTokenOptionsPageAtom,
  earnValidatorsPageAtom,
  loadMoreEarnTokenOptionsAtom,
  loadMoreEarnValidatorsPageAtom,
  rememberEarnValidatorsAtom,
  retryEarnMachineAtom,
} from "./atoms-state/machine/view-resources";
import type { EarnTokenOption } from "./atoms-state/types";
import {
  earnPageInputAtom,
  earnPageQuoteAtom,
  earnPageSearchAtom,
  earnPageSelectionAtom,
  earnPageSubmittedAtom,
} from "./page-workflow";
import { pendingActionDeepLinkViewAtom } from "./pending-action-deep-link";

const normalizedValidatorSearchAtom = Atom.make((get) =>
  get(earnPageSearchAtom).validator.trim()
).pipe(Atom.withLabel("normalizedEarnValidatorSearchAtom"));

const debouncedValidatorSearchResultAtom = appRuntime
  .atom((get) =>
    get
      .stream(normalizedValidatorSearchAtom)
      .pipe(Stream.changes, Stream.debounce(Duration.millis(300)))
  )
  .pipe(Atom.withLabel("debouncedEarnValidatorSearchResultAtom"));

const debouncedValidatorSearchAtom = Atom.make((get) =>
  get(debouncedValidatorSearchResultAtom).pipe(
    AsyncResult.value,
    Option.getOrElse(() => "")
  )
).pipe(Atom.withLabel("debouncedEarnValidatorSearchAtom"));

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
  const machine = get(earnMachineViewAtom);
  const search = get(earnPageSearchAtom).token;
  const all = [...machine.resources.tokenOptions.items];
  const normalizedSearch = search.toLowerCase();
  const filtered = normalizedSearch
    ? all.filter(
        (option) =>
          option.token.name.toLowerCase().includes(normalizedSearch) ||
          option.token.symbol.toLowerCase().includes(normalizedSearch)
      )
    : all;
  const page = get(earnTokenOptionsPageAtom);
  const loading =
    machine.status === "resolving-wallet" ||
    machine.status === "loading-token-options" ||
    machine.status === "loading-initial-selection" ||
    (machine.resources.tokenOptions.waiting && all.length === 0);

  return {
    all,
    filtered,
    hasMore: page.hasMore,
    isLoading: loading,
    isLoadingMore: page.isLoadingMore,
    search,
    selected: machine.selection.token,
  } as const;
}).pipe(Atom.withLabel("earnTokenSelectionViewAtom"));

export const setEarnTokenSearchAtom = Atom.fnSync((token: string, context) => {
  const search = context(earnPageSearchAtom);
  context.set(earnPageSearchAtom, { ...search, token });
}).pipe(Atom.withLabel("setEarnTokenSearchAtom"));

export const selectEarnTokenAtom = appRuntime
  .fn((token: EarnTokenOption, context) => {
    context.set(earnMachineIntentAtom, {
      type: "token/select",
      tokenKey: tokenString(token.token),
    });
    return TrackingService.use((tracking) =>
      tracking.trackEvent("tokenSelected", { token: token.token.symbol })
    );
  })
  .pipe(Atom.withLabel("selectEarnTokenAtom"));

export const loadMoreEarnTokensAtom = loadMoreEarnTokenOptionsAtom;

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
  const machine = get(earnMachineViewAtom);
  const selected = machine.selection.yield as EarnYieldWithProvider | null;
  const availableYields = machine.resources.yields
    .items as ReadonlyArray<EarnYieldWithProvider>;
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
    !!config.dashboardVariant && config.yieldGrouping === "category";
  const category = machine.selection.category;
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
    machine.resources.tokenOptions.waiting &&
    machine.resources.tokenOptions.items.length === 0;
  const yieldLoading =
    machine.status === "loading-yields" || machine.resources.yields.waiting;

  return {
    all,
    availableCategories: categoryGrouping
      ? [...machine.availableCategories]
      : [],
    filtered,
    groups: groupYields(filtered),
    isLoading:
      machine.status === "resolving-wallet" ||
      machine.status === "loading-initial-selection" ||
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
  context.set(earnMachineIntentAtom, { type: "yield/select", yieldId })
).pipe(Atom.withLabel("selectEarnYieldAtom"));

export const selectEarnCategoryAtom = Atom.fnSync(
  (category: DashboardYieldCategory, context) => {
    const config = context(widgetConfigAtom);
    if (
      !config.dashboardVariant ||
      config.yieldGrouping !== "category" ||
      context(earnMachineViewAtom).selection.category === category
    ) {
      return;
    }
    context.set(earnMachineIntentAtom, { type: "category/select", category });
  }
).pipe(Atom.withLabel("selectEarnCategoryAtom"));

const earnValidatorOptionsAtom = Atom.make((get) =>
  get(earnValidatorsPageAtom(get(debouncedValidatorSearchAtom) || null))
).pipe(Atom.withLabel("earnValidatorOptionsAtom"));

export const earnValidatorSelectionViewAtom = Atom.make((get) => {
  const config = get(widgetConfigAtom);
  const machine = get(earnMachineViewAtom);
  const resource = machine.resources.validators;
  const debouncedSearch = get(debouncedValidatorSearchAtom);
  const normalizedSearch = get(normalizedValidatorSearchAtom);
  const page = get(earnValidatorOptionsAtom);
  const data = resolveValidatorsData({
    enabled: Boolean(machine.selection.yield && resource.enabled),
    shouldSort:
      Boolean(config.dashboardVariant) ||
      config.variant === "utila" ||
      config.variant === "porto",
    validators: page.items,
  });
  const tokenOptionsLoading =
    machine.resources.tokenOptions.waiting &&
    machine.resources.tokenOptions.items.length === 0;
  const yieldLoading =
    machine.status === "loading-yields" || machine.resources.yields.waiting;

  return {
    data,
    hasMore: page.hasMore,
    isDebouncing: normalizedSearch !== debouncedSearch,
    isLoading:
      get(earnAppLoadingAtom).isLoading ||
      tokenOptionsLoading ||
      yieldLoading ||
      normalizedSearch !== debouncedSearch ||
      (resource.enabled && page.isLoadingFirstPage),
    isLoadingMore: page.isLoadingMore,
    search: get(earnPageSearchAtom).validator,
    selected: get(selectedValidatorsAtom),
    selectedYield: machine.selection.yield,
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

export const setEarnValidatorSearchAtom = Atom.fnSync(
  (validator: string, context) => {
    const search = context(earnPageSearchAtom);
    context.set(earnPageSearchAtom, { ...search, validator });
  }
).pipe(Atom.withLabel("setEarnValidatorSearchAtom"));

export const selectEarnValidatorAtom = appRuntime
  .fn((validatorKey: EarnValidatorKey, context) => {
    const machine = context(earnMachineViewAtom);
    const selectedYield = machine.selection.yield;
    const validator = context(earnValidatorOptionsAtom).items.find(
      (candidate) => candidate.key === validatorKey
    );
    if (!selectedYield || !validator) return Effect.void;
    context.set(rememberEarnValidatorsAtom, [validator]);
    context.set(
      earnMachineIntentAtom,
      isYieldActionArgRequired(selectedYield, "enter", "validatorAddresses")
        ? {
            type: "validator/multiselect",
            validatorKey: validator.key,
          }
        : { type: "validator/select", validatorKey: validator.key }
    );
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
    const validator = context(
      earnMachineViewAtom
    ).resources.validators.items.find(
      (candidate) => candidate.key === validatorKey
    );
    if (!validator) return Effect.void;
    context.set(earnMachineIntentAtom, {
      type: "validator/remove",
      validatorKey,
    });
    return TrackingService.use((tracking) =>
      tracking.trackEvent("validatorRemoved", {
        validatorName: validator.name,
        validatorAddress: validator.address,
      })
    );
  })
  .pipe(Atom.withLabel("removeEarnValidatorAtom"));

export const loadMoreEarnValidatorsAtom = Atom.fnSync(
  (_input: undefined, context) => {
    context.set(
      loadMoreEarnValidatorsPageAtom,
      context(debouncedValidatorSearchAtom) || null
    );
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("loadMoreEarnValidatorsAtom"));

const earnYieldEntryInputAtom = Atom.make((get) => {
  const config = get(widgetConfigAtom);
  const machine = get(earnMachineViewAtom);
  const input = get(earnPageInputAtom);
  const quote = get(earnPageQuoteAtom);
  const selection = get(earnPageSelectionAtom);
  const selectedYield = quote.selectedStake as EarnYieldWithProvider | null;
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
    machine.resources.tokenOptions.waiting &&
    machine.resources.tokenOptions.items.length === 0;
  const yieldLoading =
    machine.status === "loading-yields" || machine.resources.yields.waiting;
  const isFetching =
    machine.resources.tokenOptions.waiting ||
    machine.resources.positions.waiting ||
    machine.resources.yields.waiting;

  return {
    availableAmount,
    canSubmit: machine.can.submit,
    connected,
    defaultToMinimum: false,
    destination: makeClassicTransactionFlowDestination({ routeBase: "" }),
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
    hasNoYields: machine.status === "no-yields",
    isAppLoading: get(earnAppLoadingAtom).isLoading,
    isFetching,
    isKycBlocking: kyc.isGateBlocking,
    isKycLoading: kyc.isLoading,
    isLedgerAccountPlaceholder:
      connected && wallet.isLedgerLiveAccountPlaceholder,
    isOwnerCurrent: true,
    isWalletConnecting: wallet.status === "connecting",
    kyc,
    positionsData: machine.resources.positions.data,
    providers: summary.providers,
    selectedTokenOption,
    submitted: get(earnPageSubmittedAtom),
    validateAmount: connected,
    wallet: {
      additionalAddresses: connected ? wallet.additionalAddresses : null,
      address: connected ? wallet.address : null,
      isLedgerLive: wallet.isLedgerLive,
    },
    walletScope,
  } as const;
}).pipe(Atom.withLabel("earnYieldEntryInputAtom"));

const earnYieldEntry = makeYieldEntry(earnYieldEntryInputAtom, {
  markSubmitted: (context) => context.set(earnPageSubmittedAtom, true),
  onConnectWallet: () =>
    TrackingService.use((tracking) =>
      tracking.trackEvent("connectWalletClicked")
    ),
  runAddLedgerAccount: (context) => {
    const wallet = context(walletConnectionStateAtom);
    if (wallet.status !== "connected") {
      return Effect.die("Ledger account setup requires a connected wallet.");
    }
    const connector = isLedgerLiveConnector(wallet.connector)
      ? wallet.connector
      : null;
    return Effect.all(
      [
        TrackingService.use((tracking) =>
          tracking.trackEvent("addLedgerAccountClicked")
        ),
        runAddLedgerAccount({
          chain: wallet.chain,
          connector,
        }),
      ],
      { concurrency: "unbounded", discard: true }
    );
  },
  refreshKyc: (context) => {
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
});

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
      isBlocking: input.kyc.isGateBlocking,
      isChecking:
        input.kyc.isLoading || input.kyc.isFetching || input.kyc.isRefetching,
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
  context.set(earnMachineIntentAtom, {
    type: "stakeAmount/change",
    amount: amount.toString(10),
  })
).pipe(Atom.withLabel("setEarnAmountAtom"));

export const selectEarnProviderAtom = Atom.fnSync(
  (providerYieldId: YieldId, context) =>
    context.set(earnMachineIntentAtom, {
      type: "providerYieldId/select",
      providerYieldId,
    })
).pipe(Atom.withLabel("selectEarnProviderAtom"));

export const selectEarnTronResourceAtom = Atom.fnSync(
  (tronResource: TronResource, context) =>
    context.set(earnMachineIntentAtom, {
      type: "tronResource/select",
      tronResource,
    })
).pipe(Atom.withLabel("selectEarnTronResourceAtom"));

export const setEarnMaxAmountAtom = appRuntime
  .fn((_input: undefined, context) => {
    const constraints = getYieldAmountConstraints({
      type: "enter",
      availableAmount:
        context(earnEntryViewAtom).selectedTokenAvailableAmount?.amount ?? null,
      positionsData: context(earnMachineViewAtom).resources.positions.data,
      yield: context(earnEntryViewAtom).selectedStake,
    });
    context.set(earnMachineIntentAtom, {
      type: "stakeAmount/max",
      amount: constraints.allowedMaximum.toString(10),
    });
    return TrackingService.use((tracking) =>
      tracking.trackEvent("earnPageMaxClicked")
    );
  })
  .pipe(Atom.withLabel("setEarnMaxAmountAtom"));

export const refreshEarnKycAtom = earnYieldEntry.refreshKycAtom;

export const retryEarnPageAtom = retryEarnMachineAtom;

export const earnPageStatusViewAtom = Atom.make((get) => {
  const machine = get(earnMachineViewAtom);
  return {
    canRetry: machine.failure !== null,
    hasNoYields: machine.status === "no-yields",
    isError: machine.status === "failed",
    machineStatus: machine.status,
    presentationFrozen: get(earnAppLoadingAtom).presentationFrozen,
  } as const;
}).pipe(Atom.withLabel("earnPageStatusViewAtom"));

export const runEarnPrimaryActionAtom = earnYieldEntry.submitAtom;
