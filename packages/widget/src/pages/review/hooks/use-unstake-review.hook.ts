import { withRequestErrorRetry } from "@sk-widget/common/utils";
import { getValidStakeSessionTx } from "@sk-widget/domain";
import { useStakeExitData } from "@sk-widget/hooks/use-stake-exit-data";
import { useUnstakeMachine } from "@sk-widget/pages/position-details/hooks/use-unstake-machine";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common.page";
import {
  useExitStakeRequestDto,
  useExitStakeRequestDtoDispatch,
} from "@sk-widget/providers/exit-stake-request-dto";
import { useActionExitHook } from "@stakekit/api-hooks";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { EitherAsync, Maybe } from "purify-ts";
import type { ComponentProps } from "react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { RewardTokenDetails } from "../../../components/molecules/reward-token-details";
import { useSavedRef, useTokensPrices } from "../../../hooks";
import { formatNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";

export const useUnstakeActionReview = () => {
  const {
    stakeExitData,
    stakeExitTxGas,
    isGasCheckError,
    gasEstimateLoading,
    amount,
  } = useStakeExitData();

  const { t } = useTranslation();

  const integrationData = stakeExitData.map((val) => val.integrationData);
  const interactedToken = stakeExitData.map((val) => val.interactedToken);

  const formattedAmount = amount.map((val) => formatNumber(val));

  const title: Maybe<string> = integrationData.map((d) => {
    switch (d.metadata.type) {
      case "staking":
      case "liquid-staking":
        return t("position_details.unstake");

      default:
        return t("position_details.withdraw");
    }
  });

  const navigate = useNavigate();

  const pricesState = useTokensPrices({
    token: interactedToken,
    yieldDto: integrationData,
  });

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: stakeExitTxGas,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: integrationData,
      }),
    [integrationData, pricesState.data, stakeExitTxGas]
  );

  const actionEnter = useActionExitHook();
  const exitRequest = useExitStakeRequestDto();
  const setExitDto = useExitStakeRequestDtoDispatch();
  const exitRequestDto = useMemo(
    () => Maybe.fromNullable(exitRequest).unsafeCoerce(),
    [exitRequest]
  );

  const exitMutation = useMutation({
    mutationFn: async () => {
      return (
        await withRequestErrorRetry({
          fn: () => actionEnter(exitRequestDto.dto),
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
    const mutate = await exitMutation.mutateAsync();
    Maybe.fromNullable(mutate).map((val) => {
      // CHECK THIS => prev && { ...prev, val }
      setExitDto((prev) => prev && { ...prev, val });
    });
  };

  useEffect(() => {
    exitMutation.isSuccess && navigate("../steps", { relative: "path" });
  }, [exitMutation.isSuccess, navigate]);

  const rewardTokenDetailsProps = integrationData
    .chainNullable((v) =>
      v.metadata.provider ? { provider: v.metadata.provider, rest: v } : null
    )
    .map<ComponentProps<typeof RewardTokenDetails>>((v) => {
      const rewardToken = Maybe.of({
        logoUri: v.provider.logoURI,
        providerName: v.provider.name,
        symbol: v.rest.token.symbol,
      });

      return { type: "unstake", rewardToken };
    });

  const onClickRef = useSavedRef(onClick);

  useRegisterFooterButton(
    useMemo(
      () => ({
        label: t("shared.confirm"),
        onClick: () => onClickRef.current(),
        disabled: false,
        isLoading: exitMutation.isPending,
      }),
      [onClickRef, t, exitMutation.isPending]
    )
  );

  const metaInfo: MetaInfoProps = useMemo(() => ({ showMetaInfo: false }), []);

  const [machine, send] = useUnstakeMachine();

  const unstakeIsLoading =
    machine.value === "unstakeCheck" ||
    machine.value === "unstakeGetVerificationMessageLoading" ||
    machine.value === "unstakeSignMessageLoading" ||
    machine.value === "unstakeLoading";

  const onUnstakeClick = () => {
    navigate("../review");
  };

  const onContinueUnstakeSignMessage = () => send("CONTINUE_MESSAGE_SIGN");
  const onCloseUnstakeSignMessage = () => send("CANCEL_MESSAGE_SIGN");

  const showUnstakeSignMessagePopup = machine.value === "unstakeShowPopup";

  return {
    integrationData,
    title,
    amount: formattedAmount,
    fee,
    rewardTokenDetailsProps,
    isGasCheckError,
    token: interactedToken,
    metaInfo,
    unstakeIsLoading,
    onUnstakeClick,
    onContinueUnstakeSignMessage,
    onCloseUnstakeSignMessage,
    showUnstakeSignMessagePopup,
    gasEstimateLoading,
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
