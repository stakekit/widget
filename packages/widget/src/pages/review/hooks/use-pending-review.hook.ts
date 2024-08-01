import { withRequestErrorRetry } from "@sk-widget/common/utils";
import { getValidStakeSessionTx } from "@sk-widget/domain";
import { useGasWarningCheck } from "@sk-widget/hooks/use-gas-warning-check";
import { getRewardTokenSymbols } from "@sk-widget/hooks/use-reward-token-details/get-reward-token-symbols";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common.page";
import {
  usePendingActionDispatch,
  usePendingActionState,
} from "@sk-widget/providers/pending-action-state";
import { bpsToAmount, formatNumber } from "@sk-widget/utils";
import {
  type ActionTypes,
  useActionPendingGasEstimate,
  useActionPendingHook,
  useYieldGetFeeConfiguration,
} from "@stakekit/api-hooks";
import { useMutation } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
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
  const pendingRequest = usePendingActionState().unsafeCoerce();
  const integrationId = pendingRequest.requestDto.integrationId;

  const actionPendingGasEstimate = useActionPendingGasEstimate(
    pendingRequest.requestDto,
    { query: { staleTime: 0, gcTime: 0 } }
  );

  const feeConfigDto = useYieldGetFeeConfiguration(integrationId);

  const pendingTxGas = useMemo(
    () =>
      Maybe.fromNullable(actionPendingGasEstimate.data?.amount).map(BigNumber),
    [actionPendingGasEstimate.data]
  );

  const depositFeeUsd = useMemo(
    () =>
      Maybe.fromNullable(feeConfigDto.data?.depositFeeBps)
        .map(BigNumber)
        .chain((v) => pendingTxGas.map((gas) => bpsToAmount(v, gas))),
    [feeConfigDto, pendingTxGas]
  );

  const managementFeeUsd = useMemo(
    () =>
      Maybe.fromNullable(feeConfigDto.data?.managementFeeBps)
        .map(BigNumber)
        .chain((v) => pendingTxGas.map((gas) => bpsToAmount(v, gas))),
    [feeConfigDto, pendingTxGas]
  );

  const performanceFeeUsd = useMemo(
    () =>
      Maybe.fromNullable(feeConfigDto.data?.performanceFeeBps)
        .map(BigNumber)
        .chain((v) => pendingTxGas.map((gas) => bpsToAmount(v, gas))),
    [feeConfigDto, pendingTxGas]
  );

  const gasWarningCheck = useGasWarningCheck({
    gasAmount: pendingTxGas,
    gasFeeToken: pendingRequest.gasFeeToken,
    address: pendingRequest.addresses.address,
    additionalAddresses: pendingRequest.addresses.additionalAddresses,
    isStake: false,
  });

  const amount = useMemo(
    () =>
      Maybe.fromNullable(pendingRequest.requestDto.args?.amount).map(
        (val) => new BigNumber(val ?? 0)
      ),
    [pendingRequest.requestDto.args?.amount]
  );

  const { t } = useTranslation();

  const interactedToken = useMemo(
    () => Maybe.of(pendingRequest.interactedToken),
    [pendingRequest.interactedToken]
  );

  const integrationData = useMemo(
    () => Maybe.of(pendingRequest.integrationData),
    [pendingRequest.integrationData]
  );

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

  const pricesState = useTokensPrices({
    token: interactedToken,
    yieldDto: integrationData,
  });

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: pendingTxGas,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: integrationData,
      }),
    [integrationData, pendingTxGas, pricesState.data]
  );

  const depositFee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: depositFeeUsd,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: integrationData,
      }),
    [pricesState.data, integrationData, depositFeeUsd]
  );
  const managementFee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: managementFeeUsd,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: integrationData,
      }),
    [pricesState.data, integrationData, managementFeeUsd]
  );
  const performanceFee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: performanceFeeUsd,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: integrationData,
      }),
    [pricesState.data, integrationData, performanceFeeUsd]
  );

  const actionPending = useActionPendingHook();
  const pendignActionRequestDispatch = usePendingActionDispatch();

  const actionPendingMutation = useMutation({
    mutationFn: async () => {
      return (
        await withRequestErrorRetry({
          fn: () => actionPending(pendingRequest.requestDto),
        })
          .mapLeft(() => new Error("Pending actions error"))
          .chain((actionDto) =>
            EitherAsync.liftEither(getValidStakeSessionTx(actionDto))
          )
          .ifRight((actionDto) =>
            pendignActionRequestDispatch((prev) =>
              prev.map((v) => ({ ...v, actionDto: Maybe.of(actionDto) }))
            )
          )
      ).unsafeCoerce();
    },
  });

  const onClick = () => actionPendingMutation.mutate();

  useEffect(() => {
    if (actionPendingMutation.isSuccess) {
      navigate("../steps", { relative: "path" });
    }
  }, [actionPendingMutation.isSuccess, navigate]);

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

  const formattedAmount = useMemo(() => amount.map(formatNumber), [amount]);

  return {
    integrationData,
    title,
    formattedAmount,
    fee,
    rewardTokenDetailsProps,
    token: interactedToken,
    metaInfo,
    isGasCheckWarning: !!gasWarningCheck.data,
    gasCheckLoading:
      actionPendingGasEstimate.isLoading || gasWarningCheck.isLoading,
    depositFee,
    managementFee,
    performanceFee,
    feeConfigLoading: feeConfigDto.isPending,
  };
};
