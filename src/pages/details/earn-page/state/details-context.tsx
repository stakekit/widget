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
import type { SelectedStakeData } from "../types";
import { Maybe } from "purify-ts";
import type {
  TokenBalanceScanResponseDto,
  TronResourceType,
  ValidatorDto,
  YieldDto,
  YieldType,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import type {
  NumberInputProps,
  SelectModalProps,
} from "../../../../components";
import { useYieldType } from "../../../../hooks/use-yield-type";
import { useStakeDispatch, useStakeState } from "../../../../state/stake";
import { getTokenPriceInUSD, tokenString } from "../../../../domain";
import { useRewardTokenDetails } from "../../../../hooks/use-reward-token-details";
import { useEstimatedRewards } from "../../../../hooks/use-estimated-rewards";
import { useSavedRef, useTokensPrices } from "../../../../hooks";
import { formatNumber } from "../../../../utils";
import { useMultiYields } from "../../../../hooks/api/use-multi-yields";
import { yieldTypesMap, yieldTypesSortRank } from "../../../../domain/types";
import { useNavigate } from "react-router-dom";
import { useConnectModal } from "@stakekit/rainbowkit";
import { useTranslation } from "react-i18next";
import { useOnStakeEnter } from "../hooks/use-on-stake-enter";
import { useStakeEnterRequestDto } from "../hooks/use-stake-enter-request-dto";
import { List } from "purify-ts";
import { useProvidersDetails } from "../../../../hooks/use-provider-details";
import { useWagmiConfig } from "../../../../providers/wagmi";
import { useYieldOpportunity } from "../../../../hooks/api/use-yield-opportunity";
import type { DetailsContextType } from "./types";
import { useDefaultTokens } from "../../../../hooks/api/use-default-tokens";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useTokenBalancesScan } from "../../../../hooks/api/use-token-balances-scan";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { usePendingActionDeepLink } from "../../../../state/stake/use-pending-action-deep-link";
import { useUpdateEffect } from "../../../../hooks/use-update-effect";
import { useRegisterFooterButton } from "../../../components/footer-outlet/context";
import { useAddLedgerAccount } from "../../../../hooks/use-add-ledger-account";
import { useReferralCode } from "../../../../hooks/api/referral/use-referral-code";
import { useSettings } from "../../../../providers/settings";
import { useMountAnimation } from "../../../../providers/mount-animation";
import { useMutation } from "@tanstack/react-query";
import { useBaseToken } from "../../../../hooks/use-base-token";

const DetailsContext = createContext<DetailsContextType | undefined>(undefined);

export const DetailsContextProvider = ({ children }: PropsWithChildren) => {
  const {
    actions: { onMaxClick: _onMaxClick },
    selectedToken,
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
  } = useStakeState();
  const appDispatch = useStakeDispatch();

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
        .mapOrDefault((v) => `$${formatNumber(v, 2)}`, ""),
    [baseToken, pricesState.data, selectedToken, stakeAmount]
  );

  const formattedAmount = useMemo(
    () =>
      availableAmount.mapOrDefault(
        (am) => formatNumber(new BigNumber(am), 4),
        ""
      ),
    [availableAmount]
  );

  const availableTokens = useMemo(
    () => `${formattedAmount} ${symbol}`.trim(),
    [formattedAmount, symbol]
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
          const sorted = [...filteredDtos].sort(
            (a, b) =>
              yieldTypesSortRank[a.metadata.type] -
              yieldTypesSortRank[b.metadata.type]
          );

          const groupsWithCounts = [
            ...sorted
              .reduce(
                (acc, curr) => {
                  if (!acc.has(curr.metadata.type)) {
                    acc.set(curr.metadata.type, {
                      type: curr.metadata.type,
                      title: yieldTypesMap[curr.metadata.type].title,
                      items: [curr],
                    });
                  } else {
                    acc.get(curr.metadata.type)!.items.push(curr);
                  }

                  return acc;
                },
                new Map<
                  YieldType,
                  {
                    type: YieldType;
                    title: (typeof yieldTypesMap)[YieldType]["title"];
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

            new Map<YieldType, { itemsLength: number; title: string }>()
          );

          return {
            all,
            filtered: sorted,
            groupsWithCounts,
          };
        }),
    [deferredStakeSearch, multiYields.data]
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
      appDispatch({ type: "token/select", data: tokenBalance.token }),
    [appDispatch]
  );

  const onYieldSelect = (yieldId: string) => {
    Maybe.fromNullable(multiYields.data)
      .chain((val) => List.find((v) => v.id === yieldId, val))
      .ifJust((val) => appDispatch({ type: "yield/select", data: val }));
  };

  const onValidatorSelect = (item: ValidatorDto) =>
    selectedStake.ifJust((ss) =>
      ss.args.enter.args?.validatorAddresses?.required
        ? appDispatch({ type: "validator/multiselect", data: item })
        : appDispatch({ type: "validator/select", data: item })
    );

  const onValidatorRemove = (item: ValidatorDto) =>
    appDispatch({ type: "validator/remove", data: item });

  const onStakeAmountChange: NumberInputProps["onChange"] = (val) =>
    appDispatch({ type: "stakeAmount/change", data: val });

  const { t } = useTranslation();

  const navigate = useNavigate();

  const onStakeEnter = useOnStakeEnter();
  const stakeRequestDto = useStakeEnterRequestDto();

  const { openConnectModal } = useConnectModal();

  const onClickHandler = useMutation({
    mutationFn: async () => {
      if (validation.hasErrors) return;

      if (!isConnected) return openConnectModal?.();

      return onStakeEnter.mutate(stakeRequestDto);
    },
  });

  const onClickHandlerResetRef = useSavedRef(onClickHandler.reset);

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

  const stakeMaxAmount = useMemo(
    () =>
      selectedStake.chainNullable(
        (val) => val.args.enter.args?.amount?.maximum
      ),
    [selectedStake]
  );

  const stakeMinAmount = useMemo(
    () =>
      selectedStake
        .chainNullable((val) => val.args.enter.args?.amount?.minimum)
        .filter((val) => new BigNumber(val).isGreaterThan(0)),
    [selectedStake]
  );

  useUpdateEffect(() => {
    if (onStakeEnter.isSuccess && onStakeEnter.data) {
      navigate("/review");
    }
  }, [onStakeEnter.data, onStakeEnter.isSuccess]);

  const selectedStakeYieldType = selectedStake
    .map((val) => val.metadata.type)
    .extractNullable();

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
    onStakeEnter.isError ||
    (!multiYields.data && multiYields.isError) ||
    (!tokenBalancesScan.data && tokenBalancesScan.isError);

  const buttonDisabled =
    isConnected && (isFetching || stakeRequestDto.isNothing());

  const buttonCTAText = useMemo(() => {
    switch (selectedStakeYieldType) {
      case "lending":
      case "vault":
        return t("yield_types.deposit");

      default:
        return t("yield_types.stake");
    }
  }, [selectedStakeYieldType, t]);

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
    appDispatch({
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

  useRegisterFooterButton(
    useMemo(
      () =>
        isConnected && !isLedgerLiveAccountPlaceholder
          ? {
              disabled: buttonDisabled,
              isLoading: onStakeEnter.isPending || isFetching,
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
        onStakeEnter.isPending,
        externalProviders,
        isFetching,
        t,
      ]
    )
  );

  const selectTokenIsLoading =
    tokenBalancesScanLoading || defaultTokensIsLoading;

  const selectYieldIsLoading =
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
    availableTokens,
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
    onStakeEnterIsLoading: onStakeEnter.isPending,
    selectedStakeYieldType,
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
  };

  return (
    <DetailsContext.Provider value={value}>{children}</DetailsContext.Provider>
  );
};

export const useDetailsContext = () => {
  const context = useContext(DetailsContext);

  if (!context) {
    throw new Error("useDetailsContext must be used within a DetailsContext");
  }

  return context;
};
