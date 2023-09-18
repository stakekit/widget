import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ValidatorDto,
  YieldDto,
  YieldType,
  YieldYields200,
} from "@stakekit/api-hooks";
import { NumberInputProps, SelectModalProps } from "../../../components";
import { getTokenPriceInUSD } from "../../../domain";
import { yieldTypesMap } from "../../../domain/types";
import { useSelectedStakePrice } from "../../../hooks";
import { formatTokenBalance } from "../../../utils";
import { useConnectModal } from "@stakekit/rainbowkit";
import { Token } from "@stakekit/common";
import { useSKWallet } from "../../../hooks/wallet/use-sk-wallet";
import { useYieldType } from "../../../hooks/use-yield-type";
import { useEstimatedRewards } from "../../../hooks/use-estimated-rewards";
import { useRewardTokenDetails } from "../../../hooks/use-reward-token-details";
import { useTokenAvailableAmount } from "../../../hooks/api/use-token-available-amount";
import { useMaxMinYieldAmount } from "../../../hooks/use-max-min-yield-amount";
import { useOnStakeEnter } from "./use-on-stake-enter";
import { useStakeEnterRequestDto } from "./use-stake-enter-request-dto";
import { useStakeDispatch, useStakeState } from "../../../state/stake";
import { NotEnoughGasTokenError } from "../../../api/check-gas-amount";
import { useYields } from "../../../hooks/api/opportunities";
import { createSelector } from "reselect";
import { SelectedStakeData } from "../types";
import { useFooterItems } from "./use-footer-items";

export const useDetails = () => {
  const {
    actions: { onMaxClick },
    selectedStake,
    selectedValidator,
    stakeAmount,
  } = useStakeState();
  const appDispatch = useStakeDispatch();

  const stakeTokenAvailableAmount = useTokenAvailableAmount({
    tokenDto: selectedStake.map((ss) => ss.token),
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

  const pricesState = useSelectedStakePrice({ selectedStake });

  const symbol = selectedStake.mapOrDefault((y) => y.token.symbol, "");

  const formattedPrice = useMemo(() => {
    return Maybe.fromNullable(pricesState.data)
      .chain((prices) => selectedStake.map((ss) => ({ ss, prices })))
      .chain((val) => stakeAmount.map((sa) => ({ ...val, sa })))
      .map((val) =>
        getTokenPriceInUSD({
          amount: val.sa,
          token: val.ss.token as Token,
          prices: val.prices,
          pricePerShare: undefined,
        })
      )
      .mapOrDefault((v) => `$${formatTokenBalance(v, 2)}`, "");
  }, [pricesState.data, selectedStake, stakeAmount]);

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

  const ops = useYields();

  const selectedStakeData = useMemo<Maybe<SelectedStakeData>>(
    () =>
      Maybe.fromNullable(ops.data?.pages)
        .alt(Maybe.of([]))
        .map((pages) =>
          pages.reduce(
            (acc, curr) => {
              const data = Maybe.of(deferredStakeSearch)
                .chain((val) =>
                  val.length >= 1 ? Maybe.of(val.toLowerCase()) : Maybe.empty()
                )
                .map((lowerSearch) =>
                  curr.data.filter(
                    // TODO: filtering should be done on the backend
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
                .orDefault(curr.data);

              acc.all.push(...data);

              selector(data).forEach((val) => {
                acc.groupsWithCounts.set(val.type, {
                  title: val.title,
                  itemsLength:
                    (acc.groupsWithCounts.get(val.type)?.itemsLength ?? 0) +
                    val.items.length,
                });
              });

              return acc;
            },
            {
              all: [] as YieldDto[],
              groupsWithCounts: new Map<
                YieldType,
                { itemsLength: number; title: string }
              >(),
            }
          )
        ),
    [deferredStakeSearch, ops.data?.pages]
  );

  const onEndReached = () => ops.fetchNextPage();
  const opsIsFetchingNextPage = ops.isFetchingNextPage;

  const onSearch: SelectModalProps["onSearch"] = (val) => setStakeSearch(val);

  const onItemSelect = (item: YieldDto) =>
    appDispatch({ type: "stake/select", data: item });

  const onValidatorSelect = (item: ValidatorDto) =>
    appDispatch({ type: "validator/select", data: item });

  const onStakeAmountChange: NumberInputProps["onChange"] = (val) =>
    appDispatch({ type: "stakeAmount/change", data: val });

  const { maxEnterOrExitAmount, minEnterOrExitAmount } = useMaxMinYieldAmount({
    type: "enter",
    yieldOpportunity: selectedStake,
  });

  const { isConnected } = useSKWallet();

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

  const isError = onStakeEnter.isError || ops.isError;

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

  const footerItems = useFooterItems();

  const onSelectOpportunityClose = () => setStakeSearch("");

  const isFetching = ops.isFetching || stakeTokenAvailableAmount.isFetching;

  const buttonDisabled =
    isConnected &&
    (isFetching ||
      stakeRequestDto.isNothing() ||
      !amountValid ||
      stakeAmount.isNothing() ||
      stakeAmount.map((sa) => sa.isZero()).orDefault(true) ||
      onStakeEnter.isLoading);

  return {
    availableTokens,
    formattedPrice,
    symbol,
    selectedStakeData,
    selectedStake,
    onItemSelect,
    onStakeAmountChange,
    estimatedRewards,
    yieldType,
    onMaxClick,
    stakeAmount,
    isFetching,
    amountValid,
    buttonDisabled,
    onClick,
    footerItems,
    onSearch,
    onValidatorSelect,
    selectedValidator,
    isError,
    errorMessage,
    rewardToken,
    onSelectOpportunityClose,
    onStakeEnterIsLoading: onStakeEnter.isLoading,
    selectedStakeYieldType,
    tokenAvailableAmountIsFetching: stakeTokenAvailableAmount.isFetching,
    isConnected,
    onEndReached,
    opsIsFetchingNextPage,
  };
};

const selector = createSelector(
  (val: YieldYields200["data"]) => val,
  (val) => {
    return val.reduce(
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
    );
  },
  {
    memoizeOptions: {
      maxSize: Infinity,
    },
  }
);
