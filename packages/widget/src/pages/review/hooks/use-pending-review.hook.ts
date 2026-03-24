import { useMutation, useQuery } from "@tanstack/react-query";
import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { RewardTokenDetails } from "../../../components/molecules/reward-token-details";
import { getYieldProviderDetails } from "../../../domain/types/yields";
import { useTokensPrices } from "../../../hooks/api/use-tokens-prices";
import { useGasWarningCheck } from "../../../hooks/use-gas-warning-check";
import { getRewardTokenSymbols } from "../../../hooks/use-reward-token-details/get-reward-token-symbols";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { usePendingActionStore } from "../../../providers/pending-action-store";
import { useYieldApiFetchClient } from "../../../providers/yield-api-client-provider";
import { createManageAction } from "../../../providers/yield-api-client-provider/actions";
import type { YieldPendingActionType } from "../../../providers/yield-api-client-provider/types";
import { formatNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";
import type { MetaInfoProps } from "../pages/common-page/common.page";

export const usePendingActionReview = () => {
  const pendingActionStore = usePendingActionStore();
  const yieldApiFetchClient = useYieldApiFetchClient();

  const pendingRequest = useSelector(
    pendingActionStore,
    (state) => state.context.data,
  ).unsafeCoerce();

  const actionPreviewQuery = useQuery({
    enabled: !!pendingRequest,
    queryKey: ["pending-review-action-preview", pendingRequest.requestDto],
    retry: false,
    queryFn: () =>
      createManageAction({
        addresses: pendingRequest.addresses,
        fetchClient: yieldApiFetchClient,
        requestDto: pendingRequest.requestDto,
        yieldDto: pendingRequest.integrationData,
      }),
  });

  const pendingTxGas = useMemo(
    () =>
      Maybe.fromNullable(actionPreviewQuery.data)
        .map((actionDto) =>
          actionDto.transactions.reduce(
            (acc, transaction) => acc.plus(transaction.gasEstimate ?? 0),
            new BigNumber(0),
          ),
        )
        .map((value) => (value.isZero() ? null : value))
        .chainNullable((value) => value),
    [actionPreviewQuery.data],
  );

  const amount = useMemo(
    () => new BigNumber(pendingRequest.requestDto.arguments?.amount ?? 0),
    [pendingRequest.requestDto.arguments?.amount],
  );

  const interactedToken = useMemo(
    () => Maybe.of(pendingRequest.interactedToken),
    [pendingRequest.interactedToken],
  );

  const integrationData = useMemo(
    () => Maybe.of(pendingRequest.integrationData),
    [pendingRequest.integrationData],
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
            pendingRequest.requestDto.action.toLowerCase() as Lowercase<YieldPendingActionType>
          }` as const,
        ),
      ),
    [pendingRequest.requestDto.action, t],
  );

  const navigate = useNavigate();

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: pendingTxGas,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: integrationData,
      }),
    [integrationData, pendingTxGas, pricesState.data],
  );

  const actionPendingMutation = useMutation({
    mutationFn: async () =>
      actionPreviewQuery.data ??
      (await actionPreviewQuery.refetch()).data ??
      Promise.reject(new Error("Pending actions error")),
    onSuccess: (data) => {
      pendingActionStore.send({ type: "setActionDto", data });
      navigate("../steps", { relative: "path" });
    },
  });

  const onClick = () => actionPendingMutation.mutate();

  const rewardTokenDetailsProps = useMemo(
    () =>
      integrationData
        .chainNullable((v) => {
          const provider = getYieldProviderDetails(v);

          return provider ? { provider, rest: v } : null;
        })
        .map((v) => {
          const rewardToken = Maybe.of({
            logoUri: v.provider.logoURI,
            providerName: v.provider.name,
            symbols: getRewardTokenSymbols([v.rest.token]),
            rewardTokens: [v.rest.token],
          }) satisfies ComponentProps<typeof RewardTokenDetails>["rewardToken"];

          return {
            type: "pendingAction",
            pendingAction: pendingRequest.requestDto.action,
            rewardToken,
          } satisfies ComponentProps<typeof RewardTokenDetails>;
        }),
    [integrationData, pendingRequest.requestDto.action],
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
      [onClickRef, t, actionPendingMutation.isPending],
    ),
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
      actionPreviewQuery.isLoading ||
      actionPreviewQuery.isFetching ||
      gasWarningCheck.isLoading,
  };
};
