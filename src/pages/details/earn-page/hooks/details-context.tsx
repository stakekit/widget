import {
  PropsWithChildren,
  createContext,
  useContext,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { SelectedStakeData } from "../types";
import { Maybe } from "purify-ts";
import { ExtraData, State } from "../../../../state/stake/types";
import {
  APIManager,
  TokenBalanceScanResponseDto,
  ValidatorDto,
  YieldDto,
  YieldType,
  getYieldYieldOpportunityQueryKey,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { NumberInputProps, SelectModalProps } from "../../../../components";
import { useYieldType } from "../../../../hooks/use-yield-type";
import { useStakeDispatch, useStakeState } from "../../../../state/stake";
import { useTokenAvailableAmount } from "../../../../hooks/api/use-token-available-amount";
import { getTokenPriceInUSD } from "../../../../domain";
import { Token } from "@stakekit/common";
import { useRewardTokenDetails } from "../../../../hooks/use-reward-token-details";
import { useEstimatedRewards } from "../../../../hooks/use-estimated-rewards";
import { useSelectedStakePrice } from "../../../../hooks";
import { formatTokenBalance } from "../../../../utils";
import { useMultiYields } from "../../../../hooks/api/use-multi-yields";
import { yieldTypesMap, yieldTypesSortRank } from "../../../../domain/types";
import { useNavigate } from "react-router-dom";
import { useConnectModal } from "@stakekit/rainbowkit";
import { NotEnoughGasTokenError } from "../../../../common/check-gas-amount";
import { useTranslation } from "react-i18next";
import { useOnStakeEnter } from "./use-on-stake-enter";
import { useStakeEnterRequestDto } from "./use-stake-enter-request-dto";
import { useMaxMinYieldAmount } from "../../../../hooks/use-max-min-yield-amount";
import { useSKWallet } from "../../../../hooks/wallet/use-sk-wallet";
import { List } from "purify-ts";
import { useTokensBalances } from "../../../../hooks/api/use-tokens-balances";
import { useProviderDetails } from "../../../../hooks/use-provider-details";
import { useWagmiConfig } from "../../../../providers/wagmi";
import { useYieldOpportunity } from "../../../../hooks/api/use-yield-opportunity";

type DetailsContextType = {
  availableTokens: string;
  formattedPrice: string;
  symbol: string;
  selectedStakeData: Maybe<SelectedStakeData>;
  selectedStake: ExtraData["selectedStake"];
  onYieldSelect: (yieldId: string) => void;
  onTokenBalanceSelect: (tokenBalance: TokenBalanceScanResponseDto) => void;
  onStakeAmountChange: (value: Maybe<BigNumber>) => void;
  estimatedRewards: Maybe<{
    percentage: string;
    yearly: string;
    monthly: string;
  }>;
  yieldType: string;
  onMaxClick: () => void;
  stakeAmount: State["stakeAmount"];
  isFetching: boolean;
  amountValid: boolean;
  buttonDisabled: boolean;
  onClick: () => void;
  onYieldSearch: SelectModalProps["onSearch"];
  onValidatorSelect: (item: ValidatorDto) => void;
  selectedValidator: State["selectedValidator"];
  isError: boolean;
  errorMessage: string;
  rewardToken: Maybe<{
    logoUri: string;
    symbol: string;
    providerName: string;
  }>;
  onSelectOpportunityClose: () => void;
  onStakeEnterIsLoading: boolean;
  selectedStakeYieldType: YieldType | null;
  isConnected: boolean;
  appLoading: boolean;
  multiYieldsLoading: boolean;
  yieldOpportunityLoading: boolean;
  stakeTokenAvailableAmountLoading: boolean;
  tokenBalancesScanLoading: boolean;
  selectedTokenBalance: State["selectedTokenBalance"];
  tokenBalancesData: Maybe<TokenBalanceScanResponseDto[]>;
  onTokenSearch: (value: string) => void;
  showTokenAmount: boolean;
  buttonCTAText: string;
  providerDetails: ReturnType<typeof useProviderDetails>;
};

const DetailsContext = createContext<DetailsContextType | undefined>(undefined);

export const DetailsContextProvider = ({ children }: PropsWithChildren) => {
  const {
    actions: { onMaxClick },
    selectedTokenBalance,
    selectedValidator,
    stakeAmount,
    selectedStake,
  } = useStakeState();
  const appDispatch = useStakeDispatch();

  const {
    isConnected,
    isConnecting,
    isReconnecting,
    isNotConnectedOrReconnecting,
  } = useSKWallet();

  const stakeTokenAvailableAmount = useTokenAvailableAmount({
    tokenDto: selectedTokenBalance.map((ss) => ss.token),
  });

  const availableAmount = useMemo(
    () => stakeTokenAvailableAmount.data ?? new BigNumber(0),
    [stakeTokenAvailableAmount.data]
  );

  const yieldType = useYieldType(selectedStake).mapOrDefault(
    (y) => y.title,
    ""
  );
  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    selectedValidator,
    stakeAmount,
  });
  const rewardToken = useRewardTokenDetails(selectedStake);

  const pricesState = useSelectedStakePrice({ selectedTokenBalance });

  const symbol = selectedStake.mapOrDefault((y) => y.token.symbol, "");

  const formattedPrice = useMemo(() => {
    return Maybe.fromRecord({
      prices: Maybe.fromNullable(pricesState.data),
      selectedTokenBalance,
      stakeAmount,
    })
      .map((val) =>
        getTokenPriceInUSD({
          amount: val.stakeAmount,
          token: val.selectedTokenBalance.token as Token,
          prices: val.prices,
          pricePerShare: undefined,
        })
      )
      .mapOrDefault((v) => `$${formatTokenBalance(v, 2)}`, "");
  }, [pricesState.data, selectedTokenBalance, stakeAmount]);

  const formattedAmount = useMemo(() => {
    return Maybe.fromNullable(availableAmount).mapOrDefault(
      (am) => formatTokenBalance(new BigNumber(am), 4),
      ""
    );
  }, [availableAmount]);

  const availableTokens = useMemo(
    () => `${formattedAmount} ${symbol}`.trim(),
    [formattedAmount, symbol]
  );

  const [stakeSearch, setStakeSearch] = useState("");
  const deferredStakeSearch = useDeferredValue(stakeSearch);
  const [tokenSearch, setTokenSearch] = useState("");
  const deferredTokenSearch = useDeferredValue(tokenSearch);

  const multiYields = useMultiYields(
    selectedTokenBalance.mapOrDefault((stb) => stb.availableYields, [])
  );

  const tokenBalancesScan = useTokensBalances();

  const tokenBalancesData = useMemo(
    () =>
      Maybe.fromNullable(tokenBalancesScan.data).chain((tb) =>
        Maybe.of(deferredTokenSearch)
          .chain((val) =>
            val.length >= 1 ? Maybe.of(val.toLowerCase()) : Maybe.empty()
          )
          .map((lowerSearch) =>
            tb.filter(
              (t) =>
                t.token.name.toLowerCase().includes(lowerSearch) ||
                t.token.symbol.toLowerCase().includes(lowerSearch)
            )
          )
          .alt(Maybe.of(tb))
      ),
    [deferredTokenSearch, tokenBalancesScan.data]
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
            .map((lowerSearch) =>
              yieldDtos.filter(
                (d) =>
                  d.token.name.toLowerCase().includes(lowerSearch) ||
                  d.token.symbol.toLowerCase().includes(lowerSearch) ||
                  d.metadata.name.toLowerCase().includes(lowerSearch) ||
                  d.metadata.rewardTokens?.some(
                    (rt) =>
                      rt.name.toLowerCase().includes(lowerSearch) ||
                      rt.symbol.toLowerCase().includes(lowerSearch)
                  )
              )
            )
            .alt(Maybe.of(yieldDtos))
        )
        .map((dtos) => {
          const sorted = [...dtos].sort(
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
            all: sorted,
            groupsWithCounts,
          };
        }),
    [deferredStakeSearch, multiYields.data]
  );

  const onYieldSearch: SelectModalProps["onSearch"] = (val) =>
    setStakeSearch(val);

  const onTokenSearch: SelectModalProps["onSearch"] = (val) =>
    setTokenSearch(val);

  const onTokenBalanceSelect = (tokenBalance: TokenBalanceScanResponseDto) =>
    appDispatch({
      type: "tokenBalance/select",
      data: {
        tokenBalance,
        initYield: List.head(tokenBalance.availableYields).chainNullable(
          (yId) =>
            APIManager.getQueryClient()?.getQueryData(
              getYieldYieldOpportunityQueryKey(yId)
            )
        ),
      },
    });

  const onYieldSelect = (yieldId: string) => {
    Maybe.fromNullable(multiYields.data)
      .chain((val) => List.find((v) => v.id === yieldId, val))
      .ifJust((val) => appDispatch({ type: "yield/select", data: val }));
  };

  const onValidatorSelect = (item: ValidatorDto) =>
    appDispatch({ type: "validator/select", data: item });

  const onStakeAmountChange: NumberInputProps["onChange"] = (val) =>
    appDispatch({ type: "stakeAmount/change", data: val });

  const { maxEnterOrExitAmount, minEnterOrExitAmount } = useMaxMinYieldAmount({
    type: "enter",
    yieldOpportunity: selectedStake,
  });

  const amountValid = stakeAmount.mapOrDefault(
    (sa) =>
      !isConnected ||
      (sa.isGreaterThanOrEqualTo(minEnterOrExitAmount) &&
        sa.isLessThanOrEqualTo(maxEnterOrExitAmount) &&
        sa.isLessThanOrEqualTo(availableAmount)),
    false
  );

  const { t } = useTranslation();

  const onStakeEnter = useOnStakeEnter();
  const stakeRequestDto = useStakeEnterRequestDto();

  const isError =
    onStakeEnter.isError || multiYields.isError || tokenBalancesScan.isError;

  const errorMessage =
    onStakeEnter.error instanceof NotEnoughGasTokenError
      ? t("shared.not_enough_gas_token")
      : t("shared.something_went_wrong");

  const { openConnectModal } = useConnectModal();

  const navigate = useNavigate();

  const onClick = () => {
    if (buttonDisabled) return;

    if (!isConnected) return openConnectModal?.();

    onStakeEnter.mutateAsync(stakeRequestDto).then(() => navigate("/review"));
  };

  const selectedStakeYieldType = selectedStake
    .map((val) => val.metadata.type)
    .extractNullable();

  const onSelectOpportunityClose = () => setStakeSearch("");

  const wagmiConfig = useWagmiConfig();

  const yieldOpportunityLoading = useYieldOpportunity(
    selectedStake.extract()?.id
  ).isInitialLoading;
  const appLoading = wagmiConfig.isLoading || isConnecting || isReconnecting;
  const multiYieldsLoading = multiYields.isInitialLoading;
  const stakeTokenAvailableAmountLoading =
    stakeTokenAvailableAmount.isInitialLoading;
  const tokenBalancesScanLoading = tokenBalancesScan.isInitialLoading;

  const isFetching =
    multiYields.isFetching ||
    stakeTokenAvailableAmount.isFetching ||
    tokenBalancesScan.isFetching;

  const buttonDisabled =
    isConnected &&
    (isFetching ||
      stakeRequestDto.isNothing() ||
      !amountValid ||
      stakeAmount.isNothing() ||
      stakeAmount.map((sa) => sa.isZero()).orDefault(true) ||
      onStakeEnter.isLoading);

  const buttonCTAText = useMemo(() => {
    switch (selectedStakeYieldType) {
      case "lending":
      case "vault":
        return t("yield_types.deposit");

      default:
        return t("yield_types.stake");
    }
  }, [selectedStakeYieldType, t]);

  const showTokenAmount = !isNotConnectedOrReconnecting;

  const providerDetails = useProviderDetails({
    integrationData: selectedStake,
    validatorAddress: selectedValidator.map((v) => v.address),
  });

  const value = {
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
    amountValid,
    buttonDisabled,
    onClick,
    onYieldSearch,
    onValidatorSelect,
    selectedValidator,
    isError,
    errorMessage,
    rewardToken,
    onSelectOpportunityClose,
    onStakeEnterIsLoading: onStakeEnter.isLoading,
    selectedStakeYieldType,
    isConnected,
    appLoading,
    yieldOpportunityLoading,
    multiYieldsLoading,
    tokenBalancesScanLoading,
    stakeTokenAvailableAmountLoading,
    selectedTokenBalance,
    tokenBalancesData,
    onTokenSearch,
    showTokenAmount,
    buttonCTAText,
    providerDetails,
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
