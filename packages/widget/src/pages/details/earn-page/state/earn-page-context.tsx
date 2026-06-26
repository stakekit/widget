import { useAtom, useAtomValue } from "@effect/atom-react";
import { useConnectModal } from "@stakekit/rainbowkit";
import { useMutation } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { List, Maybe } from "purify-ts";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { NumberInputProps } from "../../../../components/atoms/number-input";
import type { SelectModalProps } from "../../../../components/atoms/select-modal";
import {
  getTokenPriceInUSD,
  stakeTokenSameAsGasToken,
  tokenString,
} from "../../../../domain";
import { getKycProviderName } from "../../../../domain/types/kyc";
import type { PositionsData } from "../../../../domain/types/positions";
import type { TronResourceType } from "../../../../domain/types/tron";
import {
  type DashboardYieldCategory,
  type ExtendedYieldType,
  filterValidators,
  getDashboardYieldCategory,
  getExtendedYieldType,
  getYieldRewardTokens,
  getYieldTypeLabels,
  getYieldTypesSortRank,
  isBittensorStaking,
  isNonZeroRewardRateYield,
  isYieldActionArgRequired,
  type YieldBase,
} from "../../../../domain/types/yields";
import type { ValidatorDto } from "../../../../generated/api/yield";
import { useTokensPrices } from "../../../../hooks/api/use-tokens-prices";
import { useYieldKycGate } from "../../../../hooks/api/use-yield-kyc-gate";
import { useNavigateWithScrollToTop } from "../../../../hooks/navigation/use-navigate-with-scroll-to-top";
import {
  getPositionDetailsStakeReviewPath,
  usePositionDetailsStakeMatch,
} from "../../../../hooks/navigation/use-position-details-stake-match";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { useAddLedgerAccount } from "../../../../hooks/use-add-ledger-account";
import { useDebouncedValue } from "../../../../hooks/use-debounced-value";
import { useEstimatedRewards } from "../../../../hooks/use-estimated-rewards";
import { useInitParams } from "../../../../hooks/use-init-params";
import { useMaxMinYieldAmount } from "../../../../hooks/use-max-min-yield-amount";
import { useProvidersDetails } from "../../../../hooks/use-provider-details";
import { useRewardTokenDetails } from "../../../../hooks/use-reward-token-details";
import { useSavedRef } from "../../../../hooks/use-saved-ref";
import { useValidatorsConfig } from "../../../../hooks/use-validators-config";
import { useYieldType } from "../../../../hooks/use-yield-type";
import { useEnterStakeStore } from "../../../../providers/enter-stake-store";
import { useMountAnimation } from "../../../../providers/mount-animation";
import { useSettings } from "../../../../providers/settings";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useWagmiConfig } from "../../../../providers/wagmi";
import { defaultFormattedNumber, formatNumber } from "../../../../utils";
import type { PageCta } from "../../../components/page-cta";
import type { SelectedStakeData } from "../types";
import { YieldValidatorsPullKey } from "./effect-atom-poc/catalog/keys";
import { useEarnMachine } from "./effect-atom-poc/hooks/use-earn-machine";
import type { EarnTokenOption } from "./effect-atom-poc/types";
import type { EarnPageContextType } from "./types";
import { useAmountValidation } from "./use-amount-validation";
import { usePendingActionDeepLink } from "./use-pending-action-deep-link";
import { useStakeEnterRequestDto } from "./use-stake-enter-request-dto";

const EarnPageContext = createContext<EarnPageContextType | undefined>(
  undefined
);

const getAsyncValue = <A, E>(result: AsyncResult.AsyncResult<A, E>) =>
  AsyncResult.getOrElse(result, () => null as A | null);

const getPullItems = <A, E>(result: Atom.PullResult<A, E>): A[] =>
  getAsyncValue(result)?.items ?? [];

const isAsyncErrorWithoutValue = <A, E>(
  result: AsyncResult.AsyncResult<A, E>
) => AsyncResult.isFailure(result) && getAsyncValue(result) === null;

const maybeFromNullable = <A,>(value: A | null | undefined) =>
  Maybe.fromNullable(value);

export const EarnPageContextProvider = ({
  children,
  registerFooterButton = true,
}: PropsWithChildren<{ registerFooterButton?: boolean }>) => {
  const { t } = useTranslation();
  const initParams = useInitParams();

  const {
    dashboardVariant,
    dashboardYieldCategoryOrder,
    externalProviders,
    preferredTokenYieldsPerNetwork,
    tokensForEnabledYieldsOnly,
    variant,
    yieldGrouping,
  } = useSettings();
  const dashboardYieldCategoryGroupingEnabled =
    !!dashboardVariant && yieldGrouping === "category";
  const validatorsConfig = useValidatorsConfig();

  const {
    address,
    additionalAddresses,
    isConnected,
    isConnecting,
    isLedgerLiveAccountPlaceholder,
    chain,
    network,
  } = useSKWallet();

  const { view: machine, dispatch } = useEarnMachine({
    address: isConnected ? address : null,
    additionalAddresses,
    categoryOrder: dashboardYieldCategoryOrder,
    dashboardVariant: dashboardYieldCategoryGroupingEnabled,
    initParams: initParams.data ?? null,
    network: network ?? null,
    preferredTokenYieldsPerNetwork: preferredTokenYieldsPerNetwork ?? null,
    tokensForEnabledYieldsOnly: !!tokensForEnabledYieldsOnly,
  });

  const tokenOptions = useAtomValue(machine.resources.tokenOptionsAtom);
  const [tokenOptionsPull, pullMoreTokens] = useAtom(
    machine.resources.tokenOptionsPullAtom
  );
  const initYieldResult = useAtomValue(machine.resources.initYieldAtom);
  const positionsDataResult = useAtomValue(machine.resources.positionsDataAtom);
  const positionsData =
    getAsyncValue(positionsDataResult) ?? (new Map() as PositionsData);

  const selectedTokenOption = maybeFromNullable(machine.selection.token);
  const selectedToken = selectedTokenOption.map((option) => option.token);
  const selectedStake = maybeFromNullable(machine.selection.yield);
  const selectedStakeId = machine.selection.yield?.id ?? null;
  const filteredSelectedValidators = selectedStake
    .map((yieldDto) =>
      filterValidators({
        validatorsConfig,
        validators: [...machine.selection.validators],
        network: yieldDto.token.network,
        yieldId: yieldDto.id,
      })
    )
    .orDefault([...machine.selection.validators]);
  const selectedValidators = new Map(
    filteredSelectedValidators.map((validator) => [
      validator.address,
      validator,
    ])
  );
  const stakeAmount = new BigNumber(machine.form.stakeAmount);
  const selectedProviderYieldId = maybeFromNullable(
    machine.form.providerYieldId
  );
  const tronResource = maybeFromNullable(
    machine.form.tronResource as TronResourceType | null
  );
  const selectedDashboardYieldCategory = machine.selection.category;
  const availableDashboardYieldCategories =
    dashboardYieldCategoryGroupingEnabled
      ? [...machine.availableCategories]
      : [];
  const availableAmount = selectedTokenOption.map(
    (tokenOption) => new BigNumber(tokenOption.amount)
  );
  const hasNotYieldsForToken = machine.status === "no-yields";

  const yieldType = useYieldType(selectedStake).mapOrDefault(
    (y) => y.title,
    ""
  );

  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    selectedValidators,
    stakeAmount,
    selectedProviderYieldId,
  });
  const rewardToken = useRewardTokenDetails(selectedStake);

  const pointsRewardTokens = useMemo(
    () =>
      selectedStake
        .map(getYieldRewardTokens)
        .map((val) => val.filter((rt) => rt.isPoints)),
    [selectedStake]
  );

  const pricesState = useTokensPrices({
    token: selectedToken,
    yieldDto: selectedStake,
  });

  const symbol = selectedToken.mapOrDefault((val) => val.symbol, "");

  const rewardsTokenSymbol = useMemo(() => {
    return selectedStake
      .filter((val) => isBittensorStaking(val.id))
      .chain(() => List.head([...selectedValidators.values()]))
      .map((validator) => validator.subnet?.tokenSymbol ?? "")
      .orDefault(symbol);
  }, [selectedStake, symbol, selectedValidators]);

  const formattedPrice = useMemo(
    () =>
      Maybe.fromRecord({
        prices: Maybe.fromNullable(pricesState.data),
        selectedToken,
        selectedStake,
      })
        .map((val) =>
          getTokenPriceInUSD({
            baseToken: val.selectedStake.token,
            amount: stakeAmount,
            token: val.selectedToken,
            prices: val.prices,
            pricePerShare: null,
          })
        )
        .mapOrDefault((v) => `$${defaultFormattedNumber(v)}`, ""),
    [pricesState.data, selectedToken, stakeAmount, selectedStake]
  );

  const selectedTokenAvailableAmount = useMemo(
    () =>
      availableAmount.map((am) => ({
        symbol,
        shortFormattedAmount: defaultFormattedNumber(am),
        fullFormattedAmount: formatNumber(am),
        amount: am,
      })),
    [availableAmount, symbol]
  );

  const [stakeSearch, setStakeSearch] = useState("");
  const deferredStakeSearch = useDeferredValue(stakeSearch);
  const [tokenSearch, setTokenSearch] = useState("");
  const deferredTokenSearch = useDeferredValue(tokenSearch);
  const [validatorSearch, setValidatorSearch] = useState("");
  const normalizedValidatorSearch = validatorSearch.trim();
  const debouncedValidatorSearch = useDebouncedValue(
    normalizedValidatorSearch,
    300
  );
  const validatorSearchDebouncing =
    normalizedValidatorSearch !== debouncedValidatorSearch;

  const validatorsResource = machine.resources.validators;
  const validatorsPullAtom = validatorsResource.validatorsPullAtom(
    new YieldValidatorsPullKey({
      search: debouncedValidatorSearch || null,
    })
  );
  const loadedValidatorsMap = useAtomValue(
    validatorsResource.loadedValidatorsAtom
  );
  const [validatorsPullResult, pullMoreValidators] =
    useAtom(validatorsPullAtom);

  const yieldOptions = machine.resources.yieldsResult
    ? (getAsyncValue(machine.resources.yieldsResult) ?? [])
    : [];

  const tokenBalancesData = useMemo(
    () =>
      Maybe.of([...tokenOptions.items]).chain((tokens) =>
        Maybe.of(deferredTokenSearch)
          .chain((val) =>
            val.length >= 1 ? Maybe.of(val.toLowerCase()) : Maybe.empty()
          )
          .map((lowerSearch) => ({
            all: tokens,
            filtered: tokens.filter(
              (t) =>
                t.token.name.toLowerCase().includes(lowerSearch) ||
                t.token.symbol.toLowerCase().includes(lowerSearch)
            ),
          }))
          .alt(Maybe.of({ all: tokens, filtered: tokens }))
      ),
    [deferredTokenSearch, tokenOptions.items]
  );

  const selectedStakeData = useMemo<Maybe<SelectedStakeData>>(
    () =>
      Maybe.of([...yieldOptions])
        .map((val) =>
          selectedStake
            .filter(
              (stake) => !val.some((yieldDto) => yieldDto.id === stake.id)
            )
            .map((stake) => [stake, ...val])
            .orDefault(val)
        )
        .map((val) =>
          [...val].sort((a, b) => b.rewardRate.total - a.rewardRate.total)
        )
        .map((val) => val.filter(isNonZeroRewardRateYield))
        .chain((yieldDtos) =>
          Maybe.of(deferredStakeSearch)
            .chain((val) =>
              val.length >= 1 ? Maybe.of(val.toLowerCase()) : Maybe.empty()
            )
            .map((lowerSearch) => ({
              all: yieldDtos,
              filteredDtos: yieldDtos.filter(
                (d) =>
                  d.token.name.toLowerCase().includes(lowerSearch) ||
                  d.token.symbol.toLowerCase().includes(lowerSearch) ||
                  d.metadata.name.toLowerCase().includes(lowerSearch) ||
                  getYieldRewardTokens(d).some(
                    (rt) =>
                      rt.name.toLowerCase().includes(lowerSearch) ||
                      rt.symbol.toLowerCase().includes(lowerSearch)
                  )
              ),
            }))
            .alt(Maybe.of({ all: yieldDtos, filteredDtos: yieldDtos }))
        )
        .map(({ all, filteredDtos }) => {
          const dashboardFilteredDtos =
            dashboardYieldCategoryGroupingEnabled &&
            selectedDashboardYieldCategory
              ? filteredDtos.filter(
                  (yieldDto) =>
                    getDashboardYieldCategory(yieldDto) ===
                    selectedDashboardYieldCategory
                )
              : filteredDtos;

          const sorted = [...dashboardFilteredDtos].sort(
            (a, b) => getYieldTypesSortRank(a) - getYieldTypesSortRank(b)
          );

          const groupsWithCounts = [
            ...sorted
              .reduce(
                (acc, curr) => {
                  const extendedYieldType = getExtendedYieldType(curr);
                  if (!acc.has(extendedYieldType)) {
                    acc.set(extendedYieldType, {
                      type: extendedYieldType,
                      title: getYieldTypeLabels(curr, t).title,
                      items: [curr],
                    });
                  } else {
                    acc.get(extendedYieldType)?.items.push(curr);
                  }

                  return acc;
                },
                new Map<
                  ExtendedYieldType,
                  {
                    type: ExtendedYieldType;
                    title: ReturnType<typeof getYieldTypeLabels>["title"];
                    items: YieldBase[];
                  }
                >()
              )
              .values(),
          ].reduce(
            (acc, next) => {
              acc.set(next.type, {
                title: next.title,
                itemsLength:
                  (acc.get(next.type)?.itemsLength ?? 0) + next.items.length,
              });

              return acc;
            },

            new Map<ExtendedYieldType, { itemsLength: number; title: string }>()
          );

          return {
            all,
            filtered: sorted,
            groupsWithCounts,
          };
        }),
    [
      dashboardYieldCategoryGroupingEnabled,
      deferredStakeSearch,
      selectedStake,
      yieldOptions,
      selectedDashboardYieldCategory,
      t,
    ]
  );

  const shouldFetchValidators = validatorsResource.enabled;

  const validatorsData = useMemo(
    () =>
      selectedStake
        .filter(() => shouldFetchValidators)
        .map((yieldDto) => {
          const validators = filterValidators({
            validatorsConfig,
            validators: debouncedValidatorSearch
              ? getPullItems(validatorsPullResult)
              : [...loadedValidatorsMap.values()],
            network: yieldDto.token.network,
            yieldId: yieldDto.id,
          });

          if (dashboardVariant || variant === "utila" || variant === "porto") {
            return [...validators].sort(
              (a, b) => (b.rewardRate?.total ?? 0) - (a.rewardRate?.total ?? 0)
            );
          }

          return validators;
        }),
    [
      dashboardVariant,
      debouncedValidatorSearch,
      loadedValidatorsMap,
      selectedStake,
      shouldFetchValidators,
      variant,
      validatorsConfig,
      validatorsPullResult,
    ]
  );

  const onYieldSearch: SelectModalProps["onSearch"] = (val) =>
    setStakeSearch(val);

  const onTokenSearch: SelectModalProps["onSearch"] = (val) =>
    setTokenSearch(val);

  const onValidatorSearch: SelectModalProps["onSearch"] = (val) =>
    setValidatorSearch(val);

  const onTokenBalanceSelect = (tokenBalance: EarnTokenOption) =>
    dispatch({
      type: "token/select",
      tokenKey: tokenString(tokenBalance.token),
    });

  const onYieldSelect = (yieldId: string) => {
    dispatch({ type: "yield/select", yieldId });
  };

  const onDashboardYieldCategorySelect = (category: DashboardYieldCategory) => {
    if (!dashboardYieldCategoryGroupingEnabled) return;

    if (selectedDashboardYieldCategory === category) return;

    dispatch({
      type: "category/select",
      category,
    });
  };

  const onValidatorSelect = (item: ValidatorDto) =>
    selectedStake.ifJust((ss) =>
      isYieldActionArgRequired(ss, "enter", "validatorAddresses")
        ? dispatch({
            type: "validator/multiselect",
            validatorKey: item.address,
          })
        : dispatch({ type: "validator/select", validatorKey: item.address })
    );

  const onValidatorRemove = (item: ValidatorDto) =>
    dispatch({ type: "validator/remove", validatorKey: item.address });

  const onStakeAmountChange: NumberInputProps["onChange"] = (val) =>
    dispatch({ type: "stakeAmount/change", amount: val.toString(10) });

  const onProviderYieldIdSelect = (yieldId: string) =>
    dispatch({ type: "providerYieldId/select", providerYieldId: yieldId });

  const stakeEnterRequestDto = useStakeEnterRequestDto({
    selectedProviderYieldId,
    selectedStake,
    selectedToken,
    selectedValidators,
    stakeAmount,
    tronResource,
    useMaxAmount: machine.form.useMaxAmount,
  });
  const yieldKycGate = useYieldKycGate({ yieldDto: selectedStake });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;
  const kycProviderName = selectedStake
    .map(getKycProviderName)
    .extractNullable();
  const onKycStatusRefresh = () => yieldKycGate.refetch();

  const { openConnectModal } = useConnectModal();

  const navigate = useNavigateWithScrollToTop();
  const positionDetailsStakeMatch = usePositionDetailsStakeMatch();
  const positionDetailsStakeReviewPath = getPositionDetailsStakeReviewPath({
    balanceId: positionDetailsStakeMatch?.params.balanceId,
    integrationId: positionDetailsStakeMatch?.params.integrationId,
  });
  const enterStakeStore = useEnterStakeStore();

  const onClickHandler = useMutation({
    mutationFn: async () => {
      if (validation.hasErrors) return;
      if (stakeEnterRequestDto.isNothing()) return;

      if (!isConnected) return openConnectModal?.();
      if (kycGateIsBlocking) return;

      const val = Maybe.fromRecord({
        stakeEnterRequestDto,
        selectedToken,
      }).unsafeCoerce();

      enterStakeStore.send({
        type: "initFlow",
        data: {
          addresses: val.stakeEnterRequestDto.addresses,
          requestDto: val.stakeEnterRequestDto.dto,
          selectedToken: val.selectedToken,
          gasFeeToken: val.stakeEnterRequestDto.gasFeeToken,
          selectedStake: val.stakeEnterRequestDto.selectedStake,
          selectedValidators: val.stakeEnterRequestDto.selectedValidators,
        },
      });
      navigate(positionDetailsStakeReviewPath ?? "/review");
    },
  });

  const onClickHandlerResetRef = useSavedRef(onClickHandler.reset);

  // biome-ignore lint: false
  useEffect(() => {
    onClickHandlerResetRef.current();
  }, [isConnected, selectedStakeId, onClickHandlerResetRef]);

  const {
    maxIntegrationAmount,
    minIntegrationAmount,
    minEnterOrExitAmount,
    maxEnterOrExitAmount,
    isForceMax,
  } = useMaxMinYieldAmount({
    type: "enter",
    yieldOpportunity: selectedStake,
    availableAmount,
    positionsData,
  });

  const {
    stakeAmountGreaterThanAvailableAmount,
    stakeAmountGreaterThanMax,
    stakeAmountLessThanMin,
    stakeAmountIsZero,
  } = useAmountValidation({
    availableAmount,
    stakeAmount,
    maxEnterOrExitAmount,
    minEnterOrExitAmount,
  });

  const validation = useMemo(() => {
    const val = {
      submitted: false,
      hasErrors: false,
      errors: {
        tronResource: false,
        stakeAmountGreaterThanAvailableAmount: false,
        stakeAmountGreaterThanMax: false,
        stakeAmountLessThanMin: false,
        stakeAmountIsZero: false,
      },
    };

    if (!isConnected) return val;

    selectedStake.ifJust((ss) => {
      if (
        isYieldActionArgRequired(ss, "enter", "tronResource") &&
        tronResource.isNothing()
      ) {
        val.errors.tronResource = true;
      }
    });

    val.errors = {
      ...val.errors,
      stakeAmountGreaterThanAvailableAmount,
      stakeAmountGreaterThanMax,
      stakeAmountLessThanMin,
      stakeAmountIsZero,
    };

    val.submitted = onClickHandler.status !== "idle";
    val.hasErrors = Object.values(val.errors).some(Boolean);

    return val;
  }, [
    isConnected,
    onClickHandler.status,
    selectedStake,
    stakeAmountGreaterThanAvailableAmount,
    stakeAmountGreaterThanMax,
    stakeAmountIsZero,
    stakeAmountLessThanMin,
    tronResource,
  ]);

  const stakeMaxAmount = useMemo(
    () =>
      selectedStake
        .filter(() => maxIntegrationAmount.isJust() && !isForceMax)
        .map(() => maxEnterOrExitAmount.toNumber()),
    [maxEnterOrExitAmount, maxIntegrationAmount, isForceMax, selectedStake]
  );

  const stakeMinAmount = useMemo(
    () =>
      selectedStake
        .filter(() => minIntegrationAmount.isJust() && !isForceMax)
        .map(() => minEnterOrExitAmount.toNumber())
        .filter((val) => new BigNumber(val).isGreaterThan(0)),
    [minEnterOrExitAmount, minIntegrationAmount, isForceMax, selectedStake]
  );

  const onSelectOpportunityClose = () => setStakeSearch("");
  const onSelectTokenClose = () => setTokenSearch("");

  const wagmiConfig = useWagmiConfig();

  const pendingActionDeepLink = usePendingActionDeepLink();

  const { state } = useMountAnimation();

  const yieldOpportunityLoading =
    machine.status === "loading-yields" ||
    !!machine.resources.yieldsResult?.waiting;

  const appLoading =
    selectedToken.isNothing() ||
    !wagmiConfig.data ||
    wagmiConfig.isLoading ||
    pendingActionDeepLink.isLoading ||
    isConnecting ||
    !state.layout;

  const tokenBalancesScanLoading =
    tokenOptions.balancesResult.waiting &&
    tokenOptions.balanceItems.length === 0;
  const defaultTokensIsLoading =
    tokenOptions.defaultResult.waiting &&
    tokenOptions.defaultItems.length === 0;

  const isFetching =
    tokenOptions.defaultResult.waiting ||
    tokenOptions.balancesResult.waiting ||
    initYieldResult.waiting ||
    positionsDataResult.waiting ||
    !!machine.resources.yieldsResult?.waiting;

  const isError =
    isAsyncErrorWithoutValue(tokenOptions.defaultResult) ||
    isAsyncErrorWithoutValue(tokenOptions.balancesResult) ||
    isAsyncErrorWithoutValue(initYieldResult) ||
    isAsyncErrorWithoutValue(positionsDataResult) ||
    (machine.resources.yieldsResult
      ? isAsyncErrorWithoutValue(machine.resources.yieldsResult)
      : false);

  const buttonDisabled =
    isConnected &&
    (isFetching || stakeEnterRequestDto.isNothing() || kycGateIsBlocking);

  const buttonCTAText = useYieldType(selectedStake).mapOrDefault(
    (v) => v.cta,
    ""
  );

  const providersDetails = useProvidersDetails({
    integrationData: selectedStake,
    validators: Maybe.of(selectedValidators),
    selectedProviderYieldId,
  });

  const trackEvent = useTrackEvent();

  const onMaxClick = () => {
    trackEvent("earnPageMaxClicked");
    dispatch({
      type: "stakeAmount/max",
      amount: maxEnterOrExitAmount.toString(10),
    });
  };

  const onTronResourceSelect = (value: TronResourceType) =>
    dispatch({ type: "tronResource/select", tronResource: value });

  const onClickRef = useSavedRef(onClickHandler.mutate);

  const addLedgerAccount = useAddLedgerAccount();

  const connectClickRef = useSavedRef(() => {
    if (isLedgerLiveAccountPlaceholder && chain) {
      trackEvent("addLedgerAccountClicked");
      return addLedgerAccount.mutate(chain);
    }

    trackEvent("connectWalletClicked");
    openConnectModal?.();
  });

  const isStakeTokenSameAsGasToken = useMemo(
    () =>
      Maybe.fromRecord({ selectedStake, selectedToken }).mapOrDefault(
        (val) =>
          stakeTokenSameAsGasToken({
            stakeToken: val.selectedToken,
            yieldDto: val.selectedStake,
          }),
        false
      ),
    [selectedStake, selectedToken]
  );

  const tokenPullValue = getAsyncValue(tokenOptionsPull);
  const validatorPullValue = getAsyncValue(validatorsPullResult);
  const hasMoreTokens = tokenPullValue?.done === false;
  const hasMoreValidators = validatorPullValue?.done === false;
  const isLoadingMoreTokens =
    tokenOptionsPull.waiting && getPullItems(tokenOptionsPull).length > 0;
  const isLoadingMoreValidators =
    validatorsPullResult.waiting &&
    getPullItems(validatorsPullResult).length > 0;
  const onLoadMoreTokens = () => pullMoreTokens();
  const onLoadMoreValidators = () => pullMoreValidators();

  const selectTokenIsLoading =
    machine.status === "loading-token-options" ||
    machine.status === "loading-initial-selection" ||
    tokenBalancesScanLoading ||
    defaultTokensIsLoading;

  const selectYieldIsLoading =
    machine.status === "loading-initial-selection" ||
    yieldOpportunityLoading ||
    tokenBalancesScanLoading ||
    defaultTokensIsLoading;

  const selectValidatorIsLoading =
    defaultTokensIsLoading ||
    tokenBalancesScanLoading ||
    yieldOpportunityLoading ||
    validatorSearchDebouncing ||
    (shouldFetchValidators &&
      validatorsPullResult.waiting &&
      getPullItems(validatorsPullResult).length === 0);

  const footerIsLoading =
    defaultTokensIsLoading ||
    tokenBalancesScanLoading ||
    yieldOpportunityLoading;

  const cta = useMemo<PageCta>(
    () =>
      !registerFooterButton || hasNotYieldsForToken
        ? null
        : isConnected && !isLedgerLiveAccountPlaceholder
          ? {
              disabled: buttonDisabled,
              isLoading: !buttonCTAText || isFetching || yieldKycGate.isLoading,
              onClick: () => onClickRef.current(),
              label: buttonCTAText,
            }
          : externalProviders
            ? null
            : {
                disabled: appLoading,
                isLoading: appLoading,
                label: t(
                  isLedgerLiveAccountPlaceholder
                    ? "init.ledger_add_account"
                    : "init.connect_wallet"
                ),
                onClick: () => connectClickRef.current(),
              },
    [
      appLoading,
      buttonCTAText,
      buttonDisabled,
      connectClickRef,
      isConnected,
      isLedgerLiveAccountPlaceholder,
      onClickRef,
      externalProviders,
      isFetching,
      yieldKycGate.isLoading,
      t,
      hasNotYieldsForToken,
      registerFooterButton,
    ]
  );

  const value = {
    machine,
    machineStatus: machine.status,
    cta,
    selectedTokenAvailableAmount,
    formattedPrice,
    symbol,
    selectedStakeData,
    selectedStake,
    selectedProviderYieldId,
    selectedDashboardYieldCategory,
    availableDashboardYieldCategories,
    onDashboardYieldCategorySelect,
    onYieldSelect,
    onTokenBalanceSelect,
    onStakeAmountChange,
    onProviderYieldIdSelect,
    estimatedRewards,
    yieldType,
    onMaxClick,
    stakeAmount,
    isFetching,
    buttonDisabled,
    onClick: onClickHandler.mutate,
    kycGate: yieldKycGate.gate,
    kycGateIsBlocking,
    kycGateIsChecking:
      yieldKycGate.isLoading ||
      yieldKycGate.isFetching ||
      yieldKycGate.isRefetching,
    kycProviderName,
    onKycStatusRefresh,
    onYieldSearch,
    onValidatorSelect,
    onValidatorRemove,
    selectedValidators,
    isError,
    rewardToken,
    onSelectOpportunityClose,
    onSelectTokenClose,
    isConnected,
    appLoading,
    yieldOpportunityLoading,
    tokenBalancesScanLoading,
    tokenBalancesData,
    onTokenSearch,
    onValidatorSearch,
    buttonCTAText,
    providersDetails,
    tokenSearch,
    stakeSearch,
    defaultTokensIsLoading,
    hasMoreTokens,
    isLedgerLiveAccountPlaceholder,
    isLoadingMoreTokens,
    onLoadMoreTokens,
    tronResource,
    onTronResourceSelect,
    validation,
    pointsRewardTokens,
    selectTokenIsLoading,
    selectYieldIsLoading,
    selectValidatorIsLoading,
    footerIsLoading,
    stakeMaxAmount,
    stakeMinAmount,
    selectedToken,
    validatorsData,
    hasMoreValidators,
    isLoadingMoreValidators,
    onLoadMoreValidators,
    validatorSearch,
    hasNotYieldsForToken,
    isStakeTokenSameAsGasToken,
    rewardsTokenSymbol,
  };

  return (
    <EarnPageContext.Provider value={value}>
      {children}
    </EarnPageContext.Provider>
  );
};

export const useEarnPageContext = () => {
  const context = useContext(EarnPageContext);

  if (!context) {
    throw new Error("useEarnPageContext must be used within a EarnPageContext");
  }

  return context;
};
