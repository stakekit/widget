import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { useConnectModal } from "@stakekit/rainbowkit";
import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { PropsWithChildren } from "react";
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../app/config/use-widget-config";
import { stakeTokenSameAsGasToken } from "../../../../../../domain";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../../domain/schema/earn-models";
import type { YieldId } from "../../../../../../domain/schema/identifiers";
import type { TronResource } from "../../../../../../domain/schema/legacy-models";
import { getKycProviderName } from "../../../../../../domain/types/kyc";
import type { PositionsData } from "../../../../../../domain/types/positions";
import { getTokenPriceInUSD } from "../../../../../../domain/types/price";
import { tokenString } from "../../../../../../domain/types/tokens";
import {
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
} from "../../../../../../domain/types/yields";
import type { DashboardYieldCategory } from "../../../../../../public-api/types";
import { isLedgerLiveConnector } from "../../../../../../services/wallet/connectors/ledger/ledger-live-connector-meta";
import {
  defaultFormattedNumber,
  formatNumber,
} from "../../../../../../shared/lib/number-format";
import {
  getPositionDetailsStakeReviewPath,
  usePositionDetailsStakeMatch,
} from "../../../../../../shared/react/navigation/use-position-details-stake-match";
import { useDebouncedValue } from "../../../../../../shared/react/use-debounced-value";
import { useSavedRef } from "../../../../../../shared/react/use-saved-ref";
import { useMountAnimation } from "../../../../../mount-animation/react/use-mount-animation";
import { useTrackEvent } from "../../../../../tracking/react/use-track-event";
import { useSetEnterStakeRequest } from "../../../../../transaction-flow/react/use-transaction-flow";
import { useCloseChainModal } from "../../../../../wallet/react/use-close-chain-modal";
import { useSKWallet } from "../../../../../wallet/react/use-wallet";
import { useWalletConfig } from "../../../../../wallet/state/root-atom";
import { currentWalletScopeAtom } from "../../../../../wallet/state/selectors";
import { addLedgerAccountAtom } from "../../../../../wallet/state/workflows";
import type { PageCta } from "../../../../../widget-shell/page-cta";
import type { NumberInputProps } from "../../../../../widget-shell/ui/number-input";
import type { SelectModalProps } from "../../../../../widget-shell/ui/select-modal";
import { useNavigateWithScrollToTop } from "../../../../../widget-shell/use-navigate-with-scroll-to-top";
import { useEstimatedRewards } from "../../../../react/use-estimated-rewards";
import { useMaxMinYieldAmount } from "../../../../react/use-max-min-yield-amount";
import { useProvidersDetails } from "../../../../react/use-provider-details";
import { useRewardTokenDetails } from "../../../../react/use-reward-token-details";
import { useValidatorsConfig } from "../../../../react/use-validators-config";
import { useYieldKycGate } from "../../../../react/use-yield-kyc-gate";
import { useYieldType } from "../../../../react/use-yield-type";
import {
  getTokensPricesRequest,
  PricesKey,
  pricesAtom,
} from "../../../../resources/prices";
import { YieldValidatorsPullKey } from "../../../../state/atoms-state/catalog/keys";
import { useEarnMachine } from "../../../../state/atoms-state/hooks/use-earn-machine";
import type { EarnTokenOption } from "../../../../state/atoms-state/types";
import {
  earnPageSearchAtom,
  earnPageSubmittedAtom,
  getEarnPageValidation,
} from "../../../../state/page-workflow";
import type { SelectedStakeData } from "../types";
import type { EarnPageModel } from "./types";
import { useAmountValidation } from "./use-amount-validation";
import { usePendingActionDeepLink } from "./use-pending-action-deep-link";
import { useStakeEnterRequestDto } from "./use-stake-enter-request-dto";

const earnPageModelAtom = Atom.make<EarnPageModel | null>(null).pipe(
  Atom.keepAlive,
  Atom.withLabel("earnPageModelAtom")
);

const getAsyncValue = <A, E>(result: AsyncResult.AsyncResult<A, E>) =>
  AsyncResult.getOrElse(result, () => null as A | null);

const getPullItems = <A, E>(result: Atom.PullResult<A, E>): A[] =>
  getAsyncValue(result)?.items ?? [];

const isAsyncErrorWithoutValue = <A, E>(
  result: AsyncResult.AsyncResult<A, E>
) => AsyncResult.isFailure(result) && getAsyncValue(result) === null;

export const EarnPageModelBinding = ({
  children,
  registerFooterButton = true,
}: PropsWithChildren<{ registerFooterButton?: boolean }>) => {
  const { t } = useTranslation();

  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const externalProviders = useWidgetConfig("externalProviders");
  const variant = useWidgetConfig("variant");
  const yieldGrouping = useWidgetConfig("yieldGrouping");
  const dashboardYieldCategoryGroupingEnabled =
    !!dashboardVariant && yieldGrouping === "category";
  const validatorsConfig = useValidatorsConfig();

  const {
    isConnected,
    isConnecting,
    isLedgerLiveAccountPlaceholder,
    chain,
    connector,
  } = useSKWallet();
  const walletScope = useAtomValue(currentWalletScopeAtom);

  const {
    dispatch,
    input: machineInput,
    quote,
    view: machine,
  } = useEarnMachine();

  const tokenOptionsResource = machine.resources.tokenOptions;
  const tokenOptionsResult = useAtomValue(
    tokenOptionsResource.loadedTokenOptionsAtom
  );
  const tokenOptions = getAsyncValue(tokenOptionsResult) ?? [];
  const [tokenOptionsPull, pullMoreTokens] = useAtom(
    tokenOptionsResource.tokenOptionsPullAtom
  );
  const positionsDataResult = useAtomValue(machine.resources.positionsDataAtom);
  const positionsData =
    getAsyncValue(positionsDataResult) ?? (new Map() as PositionsData);

  const selectedTokenOption = machine.selection.token;
  const selectedToken = selectedTokenOption?.token ?? null;
  const selectedStake = machine.selection.yield;
  const selectedStakeId = machine.selection.yield?.id ?? null;
  const filteredSelectedValidators = selectedStake
    ? filterValidators({
        validatorsConfig,
        validators: [...machine.selection.validators],
        network: selectedStake.token.network,
        yieldId: selectedStake.id,
      })
    : [...machine.selection.validators];
  const selectedValidators = new Map(
    filteredSelectedValidators.map((validator) => [validator.key, validator])
  );
  const stakeAmount = quote.stakeAmount;
  const selectedProviderYieldId = quote.selectedProviderYieldId;
  const tronResource = machineInput.tronResource as TronResource | null;
  const selectedDashboardYieldCategory = machine.selection.category;
  const availableDashboardYieldCategories =
    dashboardYieldCategoryGroupingEnabled
      ? [...machine.availableCategories]
      : [];
  const availableAmount = selectedTokenOption
    ? new BigNumber(selectedTokenOption.amount)
    : null;
  const hasNotYieldsForToken = machine.status === "no-yields";

  const yieldType = useYieldType(selectedStake)?.title ?? "";

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
        ? getYieldRewardTokens(selectedStake).filter((token) => token.isPoints)
        : null,
    [selectedStake]
  );

  const pricesRequest = getTokensPricesRequest({
    token: selectedToken,
    yieldDto: selectedStake,
  });
  const pricesResult = useAtomValue(
    pricesAtom(new PricesKey({ request: pricesRequest }))
  );
  const prices = AsyncResult.getOrElse(pricesResult, () => null);

  const symbol = selectedToken?.symbol ?? "";

  const rewardsTokenSymbol = useMemo(() => {
    return selectedStake && isBittensorStaking(selectedStake.id)
      ? EArray.head([...selectedValidators.values()]).pipe(
          Option.map((validator) => validator.subnet?.tokenSymbol ?? ""),
          Option.getOrElse(() => symbol)
        )
      : symbol;
  }, [selectedStake, symbol, selectedValidators]);

  const formattedPrice = useMemo(
    () =>
      prices && selectedToken && selectedStake
        ? `$${defaultFormattedNumber(
            getTokenPriceInUSD({
              baseToken: selectedStake.token,
              amount: stakeAmount,
              token: selectedToken,
              prices,
              pricePerShare: null,
            })
          )}`
        : "",
    [prices, selectedToken, stakeAmount, selectedStake]
  );

  const selectedTokenAvailableAmount = useMemo(
    () =>
      availableAmount
        ? {
            symbol,
            shortFormattedAmount: defaultFormattedNumber(availableAmount),
            fullFormattedAmount: formatNumber(availableAmount),
            amount: availableAmount,
          }
        : null,
    [availableAmount, symbol]
  );

  const [search, setSearch] = useAtom(earnPageSearchAtom);
  const stakeSearch = search.stake;
  const setStakeSearch = (stake: string) => setSearch({ ...search, stake });
  const deferredStakeSearch = useDeferredValue(stakeSearch);
  const tokenSearch = search.token;
  const setTokenSearch = (token: string) => setSearch({ ...search, token });
  const deferredTokenSearch = useDeferredValue(tokenSearch);
  const validatorSearch = search.validator;
  const setValidatorSearch = (validator: string) =>
    setSearch({ ...search, validator });
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
      (() => {
        const tokens = [...tokenOptions];
        const lowerSearch = deferredTokenSearch.toLowerCase();
        return {
          all: tokens,
          filtered: lowerSearch
            ? tokens.filter(
                (t) =>
                  t.token.name.toLowerCase().includes(lowerSearch) ||
                  t.token.symbol.toLowerCase().includes(lowerSearch)
              )
            : tokens,
        };
      })(),
    [deferredTokenSearch, tokenOptions]
  );

  const selectedStakeData = useMemo<SelectedStakeData>(() => {
    const combined =
      selectedStake &&
      !yieldOptions.some((yieldDto) => yieldDto.id === selectedStake.id)
        ? [selectedStake, ...yieldOptions]
        : [...yieldOptions];
    const all = combined
      .sort((a, b) => b.rewardRate.total - a.rewardRate.total)
      .filter(isNonZeroRewardRateYield);
    const lowerSearch = deferredStakeSearch.toLowerCase();
    const filteredDtos = lowerSearch
      ? all.filter(
          (yieldDto) =>
            yieldDto.token.name.toLowerCase().includes(lowerSearch) ||
            yieldDto.token.symbol.toLowerCase().includes(lowerSearch) ||
            yieldDto.metadata.name.toLowerCase().includes(lowerSearch) ||
            getYieldRewardTokens(yieldDto).some(
              (rewardToken) =>
                rewardToken.name.toLowerCase().includes(lowerSearch) ||
                rewardToken.symbol.toLowerCase().includes(lowerSearch)
            )
        )
      : all;

    const dashboardFilteredDtos =
      dashboardYieldCategoryGroupingEnabled && selectedDashboardYieldCategory
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
              items: EarnYieldWithProvider[];
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

    return { all, filtered: sorted, groupsWithCounts };
  }, [
    dashboardYieldCategoryGroupingEnabled,
    deferredStakeSearch,
    selectedStake,
    yieldOptions,
    selectedDashboardYieldCategory,
    t,
  ]);

  const shouldFetchValidators = validatorsResource.enabled;

  const validatorsData = useMemo(
    () =>
      selectedStake && shouldFetchValidators
        ? (() => {
            const validators = filterValidators({
              validatorsConfig,
              validators: debouncedValidatorSearch
                ? getPullItems(validatorsPullResult)
                : [...loadedValidatorsMap.values()],
              network: selectedStake.token.network,
              yieldId: selectedStake.id,
            });

            if (
              dashboardVariant ||
              variant === "utila" ||
              variant === "porto"
            ) {
              return [...validators].sort(
                (a, b) =>
                  (b.rewardRate?.total ?? 0) - (a.rewardRate?.total ?? 0)
              );
            }

            return validators;
          })()
        : null,
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

  const onYieldSelect = (yieldId: YieldId) =>
    dispatch({ type: "yield/select", yieldId });

  const onDashboardYieldCategorySelect = (category: DashboardYieldCategory) => {
    if (!dashboardYieldCategoryGroupingEnabled) return;

    if (selectedDashboardYieldCategory === category) return;

    dispatch({
      type: "category/select",
      category,
    });
  };

  const onValidatorSelect = (item: EarnValidator) => {
    if (!selectedStake) return;
    isYieldActionArgRequired(selectedStake, "enter", "validatorAddresses")
      ? dispatch({
          type: "validator/multiselect",
          validatorKey: item.key,
        })
      : dispatch({
          type: "validator/select",
          validatorKey: item.key,
        });
  };

  const onValidatorRemove = (item: EarnValidator) => {
    dispatch({ type: "validator/remove", validatorKey: item.key });
  };

  const onStakeAmountChange: NumberInputProps["onChange"] = (val) =>
    dispatch({ type: "stakeAmount/change", amount: val.toString(10) });

  const onProviderYieldIdSelect = (yieldId: YieldId) =>
    dispatch({ type: "providerYieldId/select", providerYieldId: yieldId });

  const stakeEnterRequestDto = useStakeEnterRequestDto({
    selectedProviderYieldId,
    selectedStake,
    selectedToken,
    selectedValidators,
    stakeAmount,
    tronResource,
    useMaxAmount: machineInput.useMaxAmount,
  });
  const yieldKycGate = useYieldKycGate({
    yieldDto: selectedStake,
  });
  const kycGateIsBlocking = yieldKycGate.isGateBlocking;
  const kycProviderName = selectedStake
    ? getKycProviderName(selectedStake)
    : null;
  const onKycStatusRefresh = () => yieldKycGate.refetch();

  const { openConnectModal } = useConnectModal();

  const navigate = useNavigateWithScrollToTop();
  const positionDetailsStakeMatch = usePositionDetailsStakeMatch();
  const positionDetailsStakeReviewPath = getPositionDetailsStakeReviewPath({
    balanceId: positionDetailsStakeMatch?.params.balanceId,
    integrationId: positionDetailsStakeMatch?.params.integrationId,
  });
  const setEnterStakeRequest = useSetEnterStakeRequest();

  const [submitted, setSubmitted] = useAtom(earnPageSubmittedAtom);
  const onClickHandler = () => {
    setSubmitted(true);
    if (validation.hasErrors) return;
    const selectedTokenValue = selectedToken;
    if (!stakeEnterRequestDto || !selectedTokenValue) return;

    if (!isConnected || !walletScope) return openConnectModal?.();
    if (kycGateIsBlocking) return;

    setEnterStakeRequest({
      actionDto: null,
      requestDto: stakeEnterRequestDto.dto,
      selectedToken: selectedTokenValue,
      gasFeeToken: stakeEnterRequestDto.gasFeeToken,
      providersDetails: providersDetails ?? [],
      selectedStake: stakeEnterRequestDto.selectedStake,
      selectedValidators: stakeEnterRequestDto.selectedValidators,
      walletScope,
    });
    navigate(positionDetailsStakeReviewPath ?? "/review");
  };

  // biome-ignore lint: false
  useEffect(() => {
    setSubmitted(false);
  }, [isConnected, selectedStakeId]);

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

  const validation = getEarnPageValidation({
    connected: isConnected,
    hasTronResource: !!tronResource,
    stakeAmountGreaterThanAvailableAmount,
    stakeAmountGreaterThanMax,
    stakeAmountIsZero,
    stakeAmountLessThanMin,
    submitted,
    tronResourceRequired: selectedStake
      ? isYieldActionArgRequired(selectedStake, "enter", "tronResource")
      : false,
  });

  const stakeMaxAmount = useMemo(
    () =>
      selectedStake && maxIntegrationAmount && !isForceMax
        ? maxEnterOrExitAmount.toNumber()
        : null,
    [maxEnterOrExitAmount, maxIntegrationAmount, isForceMax, selectedStake]
  );

  const stakeMinAmount = useMemo(
    () =>
      selectedStake &&
      minIntegrationAmount &&
      !isForceMax &&
      minEnterOrExitAmount.isGreaterThan(0)
        ? minEnterOrExitAmount.toNumber()
        : null,
    [minEnterOrExitAmount, minIntegrationAmount, isForceMax, selectedStake]
  );

  const onSelectOpportunityClose = () => setStakeSearch("");
  const onSelectTokenClose = () => setTokenSearch("");

  const walletConfig = useWalletConfig();

  const pendingActionDeepLink = usePendingActionDeepLink();

  const { state } = useMountAnimation();

  const yieldOpportunityLoading =
    machine.status === "loading-yields" ||
    !!machine.resources.yieldsResult?.waiting;

  const appLoading =
    !selectedToken ||
    !walletConfig.data ||
    walletConfig.isLoading ||
    pendingActionDeepLink.isLoading ||
    isConnecting ||
    !state.layout;

  const tokenOptionsLoading =
    tokenOptionsResult.waiting && tokenOptions.length === 0;

  const isFetching =
    tokenOptionsResult.waiting ||
    positionsDataResult.waiting ||
    !!machine.resources.yieldsResult?.waiting;

  const isError =
    isAsyncErrorWithoutValue(tokenOptionsResult) ||
    isAsyncErrorWithoutValue(positionsDataResult) ||
    (machine.resources.yieldsResult
      ? isAsyncErrorWithoutValue(machine.resources.yieldsResult)
      : false);

  const buttonDisabled =
    isConnected && (isFetching || !stakeEnterRequestDto || kycGateIsBlocking);

  const buttonCTAText = useYieldType(selectedStake)?.cta ?? "";

  const providersDetails = useProvidersDetails({
    integrationData: selectedStake,
    validators: selectedValidators,
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

  const onTronResourceSelect = (value: TronResource) =>
    dispatch({ type: "tronResource/select", tronResource: value });

  const onClickRef = useSavedRef(onClickHandler);

  const addLedgerAccount = useAtomSet(addLedgerAccountAtom);
  const { closeChainModal } = useCloseChainModal();

  const connectClickRef = useSavedRef(() => {
    if (isLedgerLiveAccountPlaceholder && chain) {
      trackEvent("addLedgerAccountClicked");
      return addLedgerAccount({
        chain,
        closeChainModal,
        connector:
          connector && isLedgerLiveConnector(connector) ? connector : null,
      });
    }

    trackEvent("connectWalletClicked");
    openConnectModal?.();
  });

  const isStakeTokenSameAsGasToken = useMemo(
    () =>
      selectedStake && selectedToken
        ? stakeTokenSameAsGasToken({
            stakeToken: selectedToken,
            yieldDto: selectedStake,
          })
        : false,
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
    machine.status === "resolving-wallet" ||
    machine.status === "loading-token-options" ||
    machine.status === "loading-initial-selection" ||
    tokenOptionsLoading;

  const selectYieldIsLoading =
    machine.status === "resolving-wallet" ||
    machine.status === "loading-initial-selection" ||
    yieldOpportunityLoading ||
    tokenOptionsLoading;

  const selectValidatorIsLoading =
    tokenOptionsLoading ||
    yieldOpportunityLoading ||
    validatorSearchDebouncing ||
    (shouldFetchValidators &&
      validatorsPullResult.waiting &&
      getPullItems(validatorsPullResult).length === 0);

  const footerIsLoading = tokenOptionsLoading || yieldOpportunityLoading;

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
    onClick: onClickHandler,
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
    tokenBalancesData,
    onTokenSearch,
    onValidatorSearch,
    buttonCTAText,
    providersDetails,
    tokenSearch,
    stakeSearch,
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

  const setModel = useAtomSet(earnPageModelAtom);
  const [modelReady, setModelReady] = useState(false);

  useLayoutEffect(() => {
    setModel(value);
    setModelReady(true);
  });

  useLayoutEffect(
    () => () => {
      setModel(null);
    },
    [setModel]
  );

  return modelReady ? children : null;
};

export const useEarnPageModel = () => {
  const model = useAtomValue(earnPageModelAtom);

  if (!model) {
    throw new Error("useEarnPageModel requires an EarnPageModelBinding");
  }

  return model;
};
