import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { RewardTokenDetails } from "../../../components/molecules/reward-token-details";
import { getTransactionGasEstimate } from "../../../domain/types/action";
import {
  getBaseYieldType,
  getYieldProviderDetails,
} from "../../../domain/types/yields";
import { useTokensPrices } from "../../../hooks/api/use-tokens-prices";
import { useGasWarningCheck } from "../../../hooks/use-gas-warning-check";
import { getRewardTokenSymbols } from "../../../hooks/use-reward-token-details/get-reward-token-symbols";
import { useSavedRef } from "../../../hooks/use-saved-ref";
import { useExitStakeStore } from "../../../providers/exit-stake-store";
import { useYieldApiFetchClient } from "../../../providers/yield-api-client-provider";
import { createExitAction } from "../../../providers/yield-api-client-provider/actions";
import { formatNumber } from "../../../utils";
import { getGasFeeInUSD } from "../../../utils/formatters";
import { useRegisterFooterButton } from "../../components/footer-outlet/context";
import { useUnstakeMachine } from "../../position-details/hooks/use-unstake-machine";
import type { MetaInfoProps } from "../pages/common-page/common.page";

export const useUnstakeActionReview = () => {
  const exitRequest = useSelector(
    useExitStakeStore(),
    (state) => state.context.data
  ).unsafeCoerce();

  const yieldApiFetchClient = useYieldApiFetchClient();

  const actionPreviewQuery = useQuery({
    enabled: !!exitRequest,
    queryKey: ["unstake-review-action-preview", exitRequest.requestDto],
    retry: false,
    queryFn: () =>
      createExitAction({
        fetchClient: yieldApiFetchClient,
        requestDto: exitRequest.requestDto,
      }),
  });

  const stakeExitTxGas = useMemo(
    () =>
      Maybe.fromNullable(actionPreviewQuery.data)
        .map((actionDto) =>
          actionDto.transactions.reduce((acc, transaction) => {
            const decoded = getTransactionGasEstimate(transaction);

            return acc.plus(decoded?.amount ?? 0);
          }, new BigNumber(0))
        )
        .map((value) => (value.isZero() ? null : value))
        .chainNullable((value) => value),
    [actionPreviewQuery.data]
  );

  const interactedToken = useMemo(
    () => Maybe.of(exitRequest.unstakeToken),
    [exitRequest.unstakeToken]
  );

  const integrationData = useMemo(
    () => Maybe.of(exitRequest.integrationData),
    [exitRequest.integrationData]
  );

  const pricesState = useTokensPrices({
    token: interactedToken,
    yieldDto: integrationData,
  });

  const amount = useMemo(
    () => new BigNumber(exitRequest.requestDto.arguments?.amount ?? 0),
    [exitRequest.requestDto.arguments?.amount]
  );

  const gasWarningCheck = useGasWarningCheck({
    gasAmount: stakeExitTxGas,
    gasFeeToken: exitRequest.gasFeeToken,
    address: exitRequest.addresses.address,
    additionalAddresses: exitRequest.addresses.additionalAddresses,
    isStake: false,
  });

  const { t } = useTranslation();

  const formattedAmount = useMemo(() => formatNumber(amount), [amount]);

  const title: Maybe<string> = integrationData.map((d) => {
    switch (getBaseYieldType(d)) {
      case "staking":
      case "liquid-staking":
        return t("position_details.unstake") as string;

      default:
        return t("position_details.withdraw");
    }
  });

  const navigate = useNavigate();

  const fee = useMemo(
    () =>
      getGasFeeInUSD({
        gas: stakeExitTxGas,
        prices: Maybe.fromNullable(pricesState.data),
        yieldDto: integrationData,
      }),
    [integrationData, pricesState.data, stakeExitTxGas]
  );

  const rewardTokenDetailsProps = integrationData
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

      return { type: "unstake", rewardToken } satisfies ComponentProps<
        typeof RewardTokenDetails
      >;
    });

  const metaInfo: MetaInfoProps = useMemo(() => ({ showMetaInfo: false }), []);

  const [machineState, send] = useUnstakeMachine({
    onDone: () => navigate("../steps", { relative: "path" }),
  });

  const unstakeIsLoading =
    machineState.matches("check") ||
    machineState.matches({ getVerificationMessage: "loading" }) ||
    machineState.matches({ signMessage: "loading" }) ||
    machineState.matches({ submit: "loading" });

  const showUnstakeSignMessagePopup = machineState.matches("showPopup");

  const onContinueUnstakeSignMessage = () =>
    send({ type: "CONTINUE_MESSAGE_SIGN" });
  const onCloseUnstakeSignMessage = () => send({ type: "CANCEL_MESSAGE_SIGN" });

  const onClick = () => {
    if (unstakeIsLoading) return;

    send({ type: "UNSTAKE" });
  };

  const onClickRef = useSavedRef(onClick);

  useRegisterFooterButton(
    useMemo(
      () => ({
        label: t("shared.confirm"),
        onClick: () => onClickRef.current(),
        disabled: false,
        isLoading: unstakeIsLoading,
      }),
      [onClickRef, t, unstakeIsLoading]
    )
  );

  return {
    integrationData,
    title,
    amount: formattedAmount,
    fee,
    rewardTokenDetailsProps,
    token: interactedToken,
    metaInfo,
    onContinueUnstakeSignMessage,
    onCloseUnstakeSignMessage,
    showUnstakeSignMessagePopup,
    gasCheckLoading:
      actionPreviewQuery.isLoading ||
      actionPreviewQuery.isFetching ||
      gasWarningCheck.isLoading,
    isGasCheckWarning: !!gasWarningCheck.data,
  };
};
