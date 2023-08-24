import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ValidatorDto, YieldOpportunityDto } from "@stakekit/api-hooks";
import { NumberInputProps, SelectModalProps } from "../../../components";
import { getTokenPriceInUSD } from "../../../domain";
import { yieldTypesMap } from "../../../domain/types";
import { useSelectedStakePrice } from "../../../hooks";
import { formatTokenBalance } from "../../../utils";
import { useStakeEnterEnabledOpportunities } from "../../../hooks/api/use-filtered-opportunities";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { SelectedStakeData } from "../types";
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

  const yieldType = useYieldType(selectedStake);
  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    selectedValidator,
    stakeAmount,
  });
  const rewardToken = useRewardTokenDetails(selectedStake);

  const opportunities = useStakeEnterEnabledOpportunities();

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

  const selectedStakeData = useMemo((): Maybe<SelectedStakeData> => {
    return Maybe.fromNullable(opportunities.data)
      .map((y) => {
        const initialData = Object.fromEntries(
          Object.entries(yieldTypesMap).map(([key, value]) => {
            const k = key as keyof typeof yieldTypesMap;
            return [k, { ...value, items: [] as YieldOpportunityDto[] }];
          })
        ) as SelectedStakeData;

        return { y, initialData };
      })
      .map(({ y, initialData }) =>
        y.reduce((acc, curr) => {
          const type = curr.config.type;

          const lowerSearch = deferredStakeSearch?.toLowerCase();

          if (
            !deferredStakeSearch ||
            curr.token.name.toLowerCase().includes(lowerSearch) ||
            curr.token.symbol.toLowerCase().includes(lowerSearch) ||
            curr.metadata.name.toLowerCase().includes(lowerSearch) ||
            curr.metadata.rewardTokens?.some(
              (rt) =>
                rt.name.toLowerCase().includes(lowerSearch) ||
                rt.symbol.toLowerCase().includes(lowerSearch)
            )
          ) {
            acc[type].items.push(curr);
          }

          return acc;
        }, initialData)
      );
  }, [opportunities.data, deferredStakeSearch]);

  const onSearch: SelectModalProps["onSearch"] = (val) => setStakeSearch(val);

  const onItemSelect = (item: YieldOpportunityDto) =>
    appDispatch({ type: "stake/select", data: item });

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
      sa.isGreaterThanOrEqualTo(minEnterOrExitAmount) &&
      sa.isLessThanOrEqualTo(maxEnterOrExitAmount) &&
      sa.isLessThanOrEqualTo(availableAmount),
    false
  );

  const { t } = useTranslation();

  const { isConnected } = useSKWallet();

  const onStakeEnter = useOnStakeEnter();
  const stakeRequestDto = useStakeEnterRequestDto();

  const isError = onStakeEnter.isError || opportunities.isError;

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
    .map((val) => val.config.type)
    .extractNullable();

  const footerItems = useMemo(() => {
    return selectedStake.mapOrDefault(
      (y) => {
        switch (y.config.type) {
          case yieldTypesMap.staking.type: {
            return {
              description: null,
            };
          }
          case yieldTypesMap.lending.type:
            return {
              description: t("details.lent_description", {
                stakeToken: y.token.symbol,
                lendToken:
                  y.metadata.rewardTokens?.map((t) => t.symbol).join(", ") ??
                  "",
              }),
            };
          case yieldTypesMap.vault.type:
            return {
              description: t("details.yearn_description", {
                stakeToken: y.token.symbol,
                depositToken:
                  y.metadata.rewardTokens?.map((t) => t.symbol).join(", ") ??
                  "",
              }),
            };
          case yieldTypesMap["liquid-staking"].type:
            return {
              description: t("details.liquid_stake_description", {
                stakeToken: y.token.symbol,
                liquidToken:
                  y.metadata.rewardTokens?.map((t) => t.symbol).join(", ") ??
                  "",
              }),
            };

          default:
            return { description: "" };
        }
      },
      { description: "" }
    );
  }, [selectedStake, t]);

  const onSelectOpportunityClose = () => setStakeSearch("");

  const isFetching =
    opportunities.isFetching || stakeTokenAvailableAmount.isFetching;

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
  };
};
