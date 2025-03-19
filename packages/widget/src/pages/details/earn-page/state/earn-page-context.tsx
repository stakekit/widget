import { useNavigateWithScrollToTop } from "@sk-widget/hooks/navigation/use-navigate-with-scroll-to-top";
import { useMaxMinYieldAmount } from "@sk-widget/hooks/use-max-min-yield-amount";
import { usePositionsData } from "@sk-widget/hooks/use-positions-data";
import {
  useEarnPageDispatch,
  useEarnPageState,
} from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";
import { usePendingActionDeepLink } from "@sk-widget/pages/details/earn-page/state/use-pending-action-deep-link";
import { useEnterStakeStore } from "@sk-widget/providers/enter-stake-store";
import type {
  TokenBalanceScanResponseDto,
  TronResourceType,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { useConnectModal } from "@stakekit/rainbowkit";
import { useMutation } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { List } from "purify-ts";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  NumberInputProps,
  SelectModalProps,
} from "../../../../components";
import {
  getTokenPriceInUSD,
  stakeTokenSameAsGasToken,
  tokenString,
} from "../../../../domain";
import {
  type ExtendedYieldType,
  getExtendedYieldType,
  getYieldTypeLabels,
  getYieldTypesSortRank,
} from "../../../../domain/types";
import { useSavedRef, useTokensPrices } from "../../../../hooks";
import { useReferralCode } from "../../../../hooks/api/referral/use-referral-code";
import { useDefaultTokens } from "../../../../hooks/api/use-default-tokens";
import { useMultiYields } from "../../../../hooks/api/use-multi-yields";
import { useTokenBalancesScan } from "../../../../hooks/api/use-token-balances-scan";
import { useYieldOpportunity } from "../../../../hooks/api/use-yield-opportunity";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { useAddLedgerAccount } from "../../../../hooks/use-add-ledger-account";
import { useBaseToken } from "../../../../hooks/use-base-token";
import { useEstimatedRewards } from "../../../../hooks/use-estimated-rewards";
import { useProvidersDetails } from "../../../../hooks/use-provider-details";
import { useRewardTokenDetails } from "../../../../hooks/use-reward-token-details";
import { useYieldType } from "../../../../hooks/use-yield-type";
import { useMountAnimation } from "../../../../providers/mount-animation";
import { useSettings } from "../../../../providers/settings";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useWagmiConfig } from "../../../../providers/wagmi";
import { defaultFormattedNumber, formatNumber } from "../../../../utils";
import { useRegisterFooterButton } from "../../../components/footer-outlet/context";
import type { SelectedStakeData } from "../types";
import type { EarnPageContextType } from "./types";
import { useStakeEnterRequestDto } from "./use-stake-enter-request-dto";

const EarnPageContext = createContext<EarnPageContextType | undefined>(
  undefined
);

export const EarnPageContextProvider = ({ children }: PropsWithChildren) => {
  const {
    actions: { onMaxClick: _onMaxClick },
    selectedToken,
    selectedStakeId,
    selectedValidators,
    stakeAmount,
    selectedStake,
    tronResource,
    stakeAmountGreaterThanAvailableAmount,
    stakeAmountGreaterThanMax,
    stakeAmountLessThanMin,
    stakeAmountIsZero,
    availableAmount,
    availableYields,
    hasNotYieldsForToken,
  } = useEarnPageState();
  const dispatch = useEarnPageDispatch();

  const { t } = useTranslation();

  const baseToken = useBaseToken(selectedStake);

  const { externalProviders } = useSettings();

  const { isConnected, isConnecting, isLedgerLiveAccountPlaceholder, chain } =
    useSKWallet();

  const yieldType = useYieldType(selectedStake).mapOrDefault(
    (y) => y.title,
    ""
  );
  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    selectedValidators,
    stakeAmount,
  });
  const rewardToken = useRewardTokenDetails(selectedStake);

  const pointsRewardTokens = useMemo(
    () =>
      selectedStake
        .chainNullable((val) => val.metadata.rewardTokens)
        .map((val) => val.filter((rt) => rt.isPoints)),
    [selectedStake]
  );

  const pricesState = useTokensPrices({
    token: selectedToken,
    yieldDto: selectedStake,
  });

  const symbol = selectedToken.mapOrDefault((val) => val.symbol, "");

  const formattedPrice = useMemo(
    () =>
      Maybe.fromRecord({
        prices: Maybe.fromNullable(pricesState.data),
        selectedToken,
        baseToken,
      })
        .map((val) =>
          getTokenPriceInUSD({
            baseToken: val.baseToken,
            amount: stakeAmount,
            token: val.selectedToken,
            prices: val.prices,
            pricePerShare: null,
          })
        )
        .mapOrDefault((v) => `$${defaultFormattedNumber(v)}`, ""),
    [baseToken, pricesState.data, selectedToken, stakeAmount]
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
  const deferredValidatorSearch = useDeferredValue(validatorSearch);

  const multiYields = useMultiYields(availableYields.orDefault([]));

  const tokenBalancesScan = useTokenBalancesScan();
  const defaultTokens = useDefaultTokens();

  const tokenBalancesData = useMemo(
    () =>
      Maybe.fromRecord({
        defTb: Maybe.fromNullable(defaultTokens.data).alt(Maybe.of([])),
        tb: Maybe.fromNullable(tokenBalancesScan.data).alt(Maybe.of([])),
      })
        .map((val) => {
          const { tbWithAmount, tbWithoutAmount, tbSet } = val.tb.reduce(
            (acc, b) => {
              acc.tbSet.add(tokenString(b.token));

              if (new BigNumber(b.amount).isGreaterThan(0)) {
                acc.tbWithAmount.push(b);
              } else {
                acc.tbWithoutAmount.push(b);
              }

              return acc;
            },
            {
              tbSet: new Set<string>(),
              tbWithAmount: [] as TokenBalanceScanResponseDto[],
              tbWithoutAmount: [] as TokenBalanceScanResponseDto[],
            }
          );

          return [
            ...tbWithAmount,
            ...tbWithoutAmount,
            ...val.defTb.filter((t) => !tbSet.has(tokenString(t.token))),
          ];
        })
        .chain((tb) =>
          Maybe.of(deferredTokenSearch)
            .chain((val) =>
              val.length >= 1 ? Maybe.of(val.toLowerCase()) : Maybe.empty()
            )
            .map((lowerSearch) => ({
              all: tb,
              filtered: tb.filter(
                (t) =>
                  t.token.name.toLowerCase().includes(lowerSearch) ||
                  t.token.symbol.toLowerCase().includes(lowerSearch)
              ),
            }))
            .alt(Maybe.of({ all: tb, filtered: tb }))
        ),
    [defaultTokens.data, deferredTokenSearch, tokenBalancesScan.data]
  );

  const selectedStakeData = useMemo<Maybe<SelectedStakeData>>(
    () =>
      Maybe.fromNullable(multiYields.data)
        .alt(Maybe.of([]))
        .map((val) => val.toSorted((a, b) => b.apy - a.apy))
        .map((val) => val.filter((v) => v.apy > 0))
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
                  d.metadata.rewardTokens?.some(
                    (rt) =>
                      rt.name.toLowerCase().includes(lowerSearch) ||
                      rt.symbol.toLowerCase().includes(lowerSearch)
                  )
              ),
            }))
            .alt(Maybe.of({ all: yieldDtos, filteredDtos: yieldDtos }))
        )
        .map(({ all, filteredDtos }) => {
          const sorted = filteredDtos.toSorted(
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
                    acc.get(extendedYieldType)!.items.push(curr);
                  }

                  return acc;
                },
                new Map<
                  ExtendedYieldType,
                  {
                    type: ExtendedYieldType;
                    title: ReturnType<typeof getYieldTypeLabels>["title"];
                    items: YieldDto[];
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
    [deferredStakeSearch, multiYields.data, t]
  );

  const validatorsData = useMemo(
    () =>
      selectedStake.chain((ss) =>
        Maybe.fromNullable(deferredValidatorSearch)
          .map((val) => val.toLowerCase())
          .map((searchInput) =>
            ss.validators.filter(
              (validator) =>
                validator.name?.toLowerCase().includes(searchInput) ||
                validator.address.toLowerCase().includes(searchInput)
            )
          )
          .alt(Maybe.of(ss.validators))
      ),
    [deferredValidatorSearch, selectedStake]
  );

  const onYieldSearch: SelectModalProps["onSearch"] = (val) =>
    setStakeSearch(val);

  const onTokenSearch: SelectModalProps["onSearch"] = (val) =>
    setTokenSearch(val);

  const onValidatorSearch: SelectModalProps["onSearch"] = (val) =>
    setValidatorSearch(val);

  const onTokenBalanceSelect = useCallback(
    (tokenBalance: TokenBalanceScanResponseDto) =>
      dispatch({ type: "token/select", data: tokenBalance.token }),
    [dispatch]
  );

  const onYieldSelect = (yieldId: string) => {
    Maybe.fromNullable(multiYields.data)
      .chain((val) => List.find((v) => v.id === yieldId, val))
      .ifJust((val) => dispatch({ type: "yield/select", data: val }));
  };

  const onValidatorSelect = (item: ValidatorDto) =>
    selectedStake.ifJust((ss) =>
      ss.args.enter.args?.validatorAddresses?.required
        ? dispatch({ type: "validator/multiselect", data: item })
        : dispatch({ type: "validator/select", data: item })
    );

  const onValidatorRemove = (item: ValidatorDto) =>
    dispatch({ type: "validator/remove", data: item });

  const onStakeAmountChange: NumberInputProps["onChange"] = (val) =>
    dispatch({ type: "stakeAmount/change", data: val });

  const stakeEnterRequestDto = useStakeEnterRequestDto();

  const { openConnectModal } = useConnectModal();

  const navigate = useNavigateWithScrollToTop();
  const enterStakeStore = useEnterStakeStore();

  const onClickHandler = useMutation({
    mutationFn: async () => {
      if (validation.hasErrors) return;

      if (!isConnected) return openConnectModal?.();

      const val = Maybe.fromRecord({
        stakeEnterRequestDto,
        selectedToken,
      }).unsafeCoerce();

      enterStakeStore.send({
        type: "initFlow",
        data: {
          requestDto: val.stakeEnterRequestDto.dto,
          selectedToken: val.selectedToken,
          gasFeeToken: val.stakeEnterRequestDto.gasFeeToken,
          selectedStake: val.stakeEnterRequestDto.selectedStake,
          selectedValidators: val.stakeEnterRequestDto.selectedValidators,
        },
      });
      navigate("/review");
    },
  });

  const onClickHandlerResetRef = useSavedRef(onClickHandler.reset);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    onClickHandlerResetRef.current();
  }, [isConnected, selectedStake, onClickHandlerResetRef]);

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
        ss.args.enter.args?.tronResource?.required &&
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
    positionsData: usePositionsData().data,
  });

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

  const yieldOpportunityLoading = useYieldOpportunity(
    selectedStake.extract()?.id
  ).isLoading;

  const referralCode = useReferralCode();

  const appLoading =
    selectedToken.isNothing() ||
    !wagmiConfig.data ||
    referralCode.isLoading ||
    wagmiConfig.isLoading ||
    pendingActionDeepLink.isLoading ||
    isConnecting ||
    !state.layout;

  const multiYieldsLoading = multiYields.isLoading;
  const tokenBalancesScanLoading = tokenBalancesScan.isLoading;
  const defaultTokensIsLoading = defaultTokens.isLoading;

  const isFetching = multiYields.isFetching || tokenBalancesScan.isFetching;

  const isError =
    (!multiYields.data && multiYields.isError) ||
    (!tokenBalancesScan.data && tokenBalancesScan.isError);

  const buttonDisabled =
    isConnected && (isFetching || stakeEnterRequestDto.isNothing());

  const buttonCTAText = useYieldType(selectedStake).mapOrDefault(
    (v) => v.cta,
    ""
  );

  const providersDetails = useProvidersDetails({
    integrationData: selectedStake,
    validatorsAddresses: Maybe.of(selectedValidators),
  });

  const trackEvent = useTrackEvent();

  const onMaxClick = () => {
    trackEvent("earnPageMaxClicked");
    _onMaxClick();
  };

  const onTronResourceSelect = (value: TronResourceType) =>
    dispatch({
      type: "tronResource/select",
      data: value,
    });

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

  useRegisterFooterButton(
    useMemo(
      () =>
        isConnected && !isLedgerLiveAccountPlaceholder
          ? {
              disabled: buttonDisabled,
              isLoading: isFetching,
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
        t,
      ]
    )
  );

  const selectTokenIsLoading =
    tokenBalancesScanLoading || defaultTokensIsLoading;

  const selectYieldIsLoading =
    (selectedStakeId.isNothing() && !hasNotYieldsForToken) ||
    multiYieldsLoading ||
    yieldOpportunityLoading ||
    tokenBalancesScanLoading ||
    defaultTokensIsLoading;

  const selectValidatorIsLoading =
    defaultTokensIsLoading ||
    tokenBalancesScanLoading ||
    multiYieldsLoading ||
    yieldOpportunityLoading;

  const footerIsLoading =
    defaultTokensIsLoading ||
    tokenBalancesScanLoading ||
    multiYieldsLoading ||
    yieldOpportunityLoading;

  const { referralCheck } = useSettings();

  const value = {
    referralCheck,
    selectedTokenAvailableAmount,
    formattedPrice,
    symbol,
    selectedStakeData,
    selectedStake,
    onYieldSelect,
    onTokenBalanceSelect,
    onStakeAmountChange,
    estimatedRewards,
    yieldType,
    onMaxClick,
    stakeAmount,
    isFetching,
    buttonDisabled,
    onClick: onClickHandler.mutate,
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
    multiYieldsLoading,
    tokenBalancesScanLoading,
    tokenBalancesData,
    onTokenSearch,
    onValidatorSearch,
    buttonCTAText,
    providersDetails,
    tokenSearch,
    stakeSearch,
    defaultTokensIsLoading,
    isLedgerLiveAccountPlaceholder,
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
    validatorSearch,
    hasNotYieldsForToken,
    isStakeTokenSameAsGasToken,
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
