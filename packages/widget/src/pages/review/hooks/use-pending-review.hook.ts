import { withRequestErrorRetry } from "@sk-widget/common/utils";
import { getValidStakeSessionTx } from "@sk-widget/domain";
import { usePendingActionData } from "@sk-widget/hooks/use-pending-action-data";
import { getRewardTokenSymbols } from "@sk-widget/hooks/use-reward-token-details/get-reward-token-symbols";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common.page";
import { usePendingStakeRequestDtoDispatch } from "@sk-widget/providers/pending-stake-request-dto";
import { type ActionTypes, useActionPendingHook } from "@stakekit/api-hooks";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { EitherAsync, Maybe } from "purify-ts";
import type { ComponentProps } from "react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { RewardTokenDetails } from "../../../components/molecules/reward-token-details";
import { useSavedRef, useTokensPrices } from "../../../hooks";
import { getGasFeeInUSD } from "../../../utils/formatters";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";

export const usePendingActionReview = () => {
  const {
    isGasCheckError,
    gasEstimatePending,
    pendingTxGas,
    pendingActionType,
    pendingActionData,
    amount,
    pendingRequestDto,
  } = usePendingActionData();

  const { integrationData, interactedToken } = pendingActionData;

  const { t } = useTranslation();

  const title: Maybe<string> = pendingActionType.map((type) =>
    t(
      `position_details.pending_action_button.${
        type.toLowerCase() as Lowercase<ActionTypes>
      }` as const
    )
  );

  const navigate = useNavigate();

  const pricesState = useTokensPrices({
    token: Maybe.of(interactedToken),
    yieldDto: Maybe.of(integrationData),
  });

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: pendingTxGas,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: Maybe.of(integrationData),
      }),
    [integrationData, pendingTxGas, pricesState.data]
  );

  const actionPending = useActionPendingHook();
  const setPendingDto = usePendingStakeRequestDtoDispatch();

  const actionPendingMutation = useMutation({
    mutationFn: async () => {
      return (
        await withRequestErrorRetry({
          fn: () => actionPending(pendingRequestDto),
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
          .chain((actionDto) =>
            EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
          )
      ).unsafeCoerce();
    },
  });

  const onClick = async () => {
    const mutate = await actionPendingMutation.mutateAsync();
    Maybe.fromNullable(mutate).map((val) => {
      // CHECK THIS => prev && { ...prev, val }
      setPendingDto((prev) => prev && { ...prev, actionDto: val });
    });
  };

  useEffect(() => {
    actionPendingMutation.isSuccess &&
      navigate("../steps", { relative: "path" });
  }, [actionPendingMutation.isSuccess, navigate]);

  const rewardTokenDetailsProps = Maybe.of(integrationData)
    .chainNullable((v) =>
      v.metadata.provider ? { provider: v.metadata.provider, rest: v } : null
    )
    .map((v) => {
      const rewardToken = Maybe.of({
        logoUri: v.provider.logoURI,
        providerName: v.provider.name,
        symbols: getRewardTokenSymbols([v.rest.token]),
        rewardTokens: [v.rest.token],
      }) satisfies ComponentProps<typeof RewardTokenDetails>["rewardToken"];

      return {
        type: "pendingAction",
        pendingAction: pendingActionType.extract()!,
        rewardToken,
      } satisfies ComponentProps<typeof RewardTokenDetails>;
    });

  const onClickRef = useSavedRef(onClick);

  useRegisterFooterButton(
    useMemo(
      () => ({
        label: t("shared.confirm"),
        onClick: () => onClickRef.current(),
        disabled: false,
        isLoading: actionPendingMutation.isPending,
      }),
      [onClickRef, t, actionPendingMutation.isPending]
    )
  );

  const metaInfo: MetaInfoProps = useMemo(() => ({ showMetaInfo: false }), []);

  return {
    integrationData,
    title,
    amount,
    fee,
    rewardTokenDetailsProps,
    isGasCheckError,
    token: Maybe.of(interactedToken),
    metaInfo,
    gasEstimatePending,
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
