import {
  type ActionTypes,
  actionPending,
  useActionPendingGasEstimate,
} from "@stakekit/api-hooks";
import { useMutation } from "@tanstack/react-query";
import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { RewardTokenDetails } from "../../../components/molecules/reward-token-details";
import { getValidStakeSessionTx } from "../../../domain";
import { useTokensPrices } from "../../../hooks/api/use-tokens-prices";
import { useGasWarningCheck } from "../../../hooks/use-gas-warning-check";
import { getRewardTokenSymbols } from "../../../hooks/use-reward-token-details/get-reward-token-symbols";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { usePendingActionStore } from "../../../providers/pending-action-store";
import { formatNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";
import type { MetaInfoProps } from "../pages/common-page/common.page";

export const usePendingActionReview = () => {
  const pendingActionStore = usePendingActionStore();

  const pendingRequest = useSelector(
    pendingActionStore,
    (state) => state.context.data
  ).unsafeCoerce();

  const actionPendingGasEstimate = useActionPendingGasEstimate(
    pendingRequest.requestDto,
    { query: { staleTime: 0, gcTime: 0 } }
  );

  const pendingTxGas = useMemo(
    () =>
      Maybe.fromNullable(actionPendingGasEstimate.data?.amount).map(BigNumber),
    [actionPendingGasEstimate.data]
  );

  const amount = useMemo(
    () => new BigNumber(pendingRequest.requestDto.args?.amount ?? 0),
    [pendingRequest.requestDto.args?.amount]
  );

  const interactedToken = useMemo(
    () => Maybe.of(pendingRequest.interactedToken),
    [pendingRequest.interactedToken]
  );

  const integrationData = useMemo(
    () => Maybe.of(pendingRequest.integrationData),
    [pendingRequest.integrationData]
  );

  const pricesState = useTokensPrices({
    token: interactedToken,
    yieldDto: integrationData,
  });

  const gasWarningCheck = useGasWarningCheck({
    gasAmount: pendingTxGas,
    gasFeeToken: pendingRequest.gasFeeToken,
    address: pendingRequest.addresses.address,
    additionalAddresses: pendingRequest.addresses.additionalAddresses,
    isStake: false,
  });

  const { t } = useTranslation();

  const title = useMemo(
    () =>
      Maybe.of(
        t(
          `position_details.pending_action_button.${
            pendingRequest.requestDto.type.toLowerCase() as Lowercase<ActionTypes>
          }` as const
        )
      ),
    [pendingRequest.requestDto.type, t]
  );

  const navigate = useNavigate();

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: pendingTxGas,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: integrationData,
      }),
    [integrationData, pendingTxGas, pricesState.data]
  );

  const actionPendingMutation = useMutation({
    mutationFn: async () =>
      (
        await EitherAsync(() => actionPending(pendingRequest.requestDto))
          .mapLeft(() => new Error("Pending actions error"))
          .chain((actionDto) =>
            EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
          )
      ).unsafeCoerce(),
    onSuccess: (data) => {
      pendingActionStore.send({ type: "setActionDto", data });
      navigate("../steps", { relative: "path" });
    },
  });

  const onClick = () => actionPendingMutation.mutate();

  const rewardTokenDetailsProps = useMemo(
    () =>
      integrationData
        .chainNullable((v) =>
          v.metadata.provider
            ? { provider: v.metadata.provider, rest: v }
            : null
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
            pendingAction: pendingRequest.requestDto.type,
            rewardToken,
          } satisfies ComponentProps<typeof RewardTokenDetails>;
        }),
    [integrationData, pendingRequest.requestDto.type]
  );

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

  const formattedAmount = useMemo(() => formatNumber(amount), [amount]);

  return {
    integrationData,
    title,
    amount: formattedAmount,
    fee,
    rewardTokenDetailsProps,
    token: interactedToken,
    metaInfo,
    isGasCheckWarning: !!gasWarningCheck.data,
    gasCheckLoading:
      actionPendingGasEstimate.isLoading || gasWarningCheck.isLoading,
  };
};
