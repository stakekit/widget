import {
  GasTokenMissingError,
  NotEnoughGasTokenError,
  checkGasAmount,
} from "@sk-widget/common/check-gas-amount";
import { withRequestErrorRetry } from "@sk-widget/common/utils";
import { getValidStakeSessionTx } from "@sk-widget/domain";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common.page";
import {
  useEnterStakeRequestDto,
  useEnterStakeRequestDtoDispatch,
} from "@sk-widget/providers/enter-stake-request-dto";
import { useSettings } from "@sk-widget/providers/settings";
import {
  useActionEnterGasEstimation,
  useActionEnterHook,
  useTokenGetTokenBalancesHook,
} from "@stakekit/api-hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import BigNumber from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSavedRef, useTokensPrices } from "../../../hooks";
import { useEstimatedRewards } from "../../../hooks/use-estimated-rewards";
import { useRewardTokenDetails } from "../../../hooks/use-reward-token-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { formatNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";

export const useStakeReview = () => {
  const enterRequest = useEnterStakeRequestDto();

  const enterRequestDto = useMemo(
    () => Maybe.fromNullable(enterRequest).unsafeCoerce(),
    [enterRequest]
  );

  const { data } = useActionEnterGasEstimation(enterRequestDto.dto);

  const stakeEnterTxGas = Maybe.fromNullable(data?.amount).map(
    (val) => new BigNumber(val)
  );
  const selectedStake = Maybe.of(enterRequestDto.selectedStake);
  const selectedValidators = enterRequestDto.selectedValidators;
  const selectedToken = Maybe.of(enterRequestDto.selectedToken);

  const tokenGetTokenBalances = useTokenGetTokenBalancesHook();

  const { data: isGasCheckError } = useQuery({
    queryKey: [
      "gas-check",
      stakeEnterTxGas.mapOrDefault((v) => v.toString(), ""),
    ],
    enabled: stakeEnterTxGas.isJust(),
    staleTime: 0,
    queryFn: async () => {
      return (
        await EitherAsync.liftEither(
          stakeEnterTxGas.toEither(new Error("No gas amount"))
        ).chain((val) =>
          checkGasAmount({
            gasEstimate: {
              amount: val,
              token: enterRequestDto.gasFeeToken,
            },
            addressWithTokenDto: {
              address: enterRequestDto.dto.addresses.address,
              network: enterRequestDto.gasFeeToken.network,
            },
            tokenGetTokenBalances,
            isStake: true,
            stakeAmount: new BigNumber(enterRequestDto.dto.args.amount),
            stakeToken: enterRequestDto.selectedToken,
          })
        )
      )
        .map(
          (val) =>
            val instanceof NotEnoughGasTokenError ||
            val instanceof GasTokenMissingError
        )
        .unsafeCoerce();
    },
  });

  const stakeAmount = useMemo(() => {
    return new BigNumber(enterRequestDto.dto.args.amount);
  }, [enterRequestDto]);

  const rewardToken = useRewardTokenDetails(selectedStake);
  const estimatedRewards = useEstimatedRewards({
    selectedStake,
    stakeAmount,
    selectedValidators,
  });
  const yieldType = useYieldType(selectedStake).mapOrDefault(
    (y) => y.review,
    ""
  );

  const amount = formatNumber(stakeAmount);
  const interestRate = estimatedRewards.mapOrDefault(
    (r) => r.percentage.toString(),
    ""
  );

  const pricesState = useTokensPrices({
    token: selectedToken,
    yieldDto: selectedStake,
  });

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: stakeEnterTxGas,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: selectedStake,
      }),
    [pricesState.data, selectedStake, stakeEnterTxGas]
  );

  const metadata = selectedStake.map((y) => y.metadata);

  const navigate = useNavigate();
  const actionEnter = useActionEnterHook();
  const setEnterDto = useEnterStakeRequestDtoDispatch();

  const [loading, setLoading] = useState(false);

  const mut = useMutation({
    mutationFn: async () => {
      return (
        await withRequestErrorRetry({
          fn: () => actionEnter(enterRequestDto.dto),
        })
          .mapLeft<StakingNotAllowedError | Error>((e) => {
            if (
              isAxiosError(e) &&
              StakingNotAllowedError.isStakingNotAllowedErrorDto(
                e.response?.data
              )
            ) {
              return new StakingNotAllowedError();
            }

            return new Error("Stake enter error");
          })
          .chain((actionDto) => {
            const a = EitherAsync.liftEither(getValidStakeSessionTx(actionDto));
            return a;
          })
      ).unsafeCoerce();
    },
  });

  const onClick = async () => {
    setLoading(true);
    const t = await mut.mutateAsync();
    Maybe.fromNullable(t).map((val) => {
      setEnterDto((prev) => ({ ...prev, val }));
      setLoading(false);
      navigate("/steps");
    });
    console.log({ t });
  };

  useEffect(() => {
    const something = false;
    if (something) {
      navigate("/steps");
    }
  }, [navigate]);

  const onClickRef = useSavedRef(onClick);

  const { t } = useTranslation();

  useRegisterFooterButton(
    useMemo(
      () => ({
        disabled: false,
        isLoading: loading,
        label: t("shared.confirm"),
        onClick: () => onClickRef.current(),
      }),
      [onClickRef, t, loading]
    )
  );

  const { variant } = useSettings();

  const metaInfo: MetaInfoProps = useMemo(
    () =>
      variant === "zerion"
        ? {
            showMetaInfo: true,
            metaInfoProps: {
              selectedStake,
              selectedToken,
              selectedValidators,
            },
          }
        : { showMetaInfo: false },
    [selectedStake, selectedToken, selectedValidators, variant]
  );

  return {
    token: selectedToken,
    amount,
    isGasCheckError: !!isGasCheckError,
    fee,
    interestRate,
    yieldType,
    rewardToken,
    metadata,
    metaInfo,
    loading: true,
  };
};

class StakingNotAllowedError extends Error {
  static isStakingNotAllowedErrorDto = (e: unknown) => {
    const dto = e as undefined | { type: string; code: number };

    return dto && dto.code === 422 && dto.type === "STAKING_ERROR";
  };

  constructor() {
    super("Staking not allowed, needs unstaking and trying again");
  }
}
