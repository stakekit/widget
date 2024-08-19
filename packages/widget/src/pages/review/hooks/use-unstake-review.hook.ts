import type { RewardTokenDetails } from "@sk-widget/components/molecules/reward-token-details";
import { useSavedRef, useTokensPrices } from "@sk-widget/hooks";
import { useGasWarningCheck } from "@sk-widget/hooks/use-gas-warning-check";
import { getRewardTokenSymbols } from "@sk-widget/hooks/use-reward-token-details/get-reward-token-symbols";
import { useRegisterFooterButton } from "@sk-widget/pages/components/footer-outlet/context";
import { useUnstakeMachine } from "@sk-widget/pages/position-details/hooks/use-unstake-machine";
import { useFees } from "@sk-widget/pages/review/hooks/use-fees";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common.page";
import { useExitStakeStore } from "@sk-widget/providers/exit-stake-store";
import { formatNumber } from "@sk-widget/utils";
import { getGasFeeInUSD } from "@sk-widget/utils/formatters";
import {
  useActionExitGasEstimate,
  useYieldGetFeeConfiguration,
} from "@stakekit/api-hooks";
import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export const useUnstakeActionReview = () => {
  const exitRequest = useSelector(
    useExitStakeStore(),
    (state) => state.context.data
  ).unsafeCoerce();

  const integrationId = exitRequest.requestDto.integrationId;

  const actionExitGasEstimate = useActionExitGasEstimate(
    exitRequest.requestDto,
    { query: { staleTime: 0, gcTime: 0 } }
  );
  const feeConfigDto = useYieldGetFeeConfiguration(integrationId);

  const stakeExitTxGas = useMemo(
    () => Maybe.fromNullable(actionExitGasEstimate.data?.amount).map(BigNumber),
    [actionExitGasEstimate.data]
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
    () => new BigNumber(exitRequest.requestDto.args.amount ?? 0),
    [exitRequest.requestDto.args.amount]
  );

  const { depositFee, managementFee, performanceFee } = useFees({
    amount,
    token: interactedToken,
    feeConfigDto: useMemo(
      () => Maybe.fromNullable(feeConfigDto.data),
      [feeConfigDto.data]
    ),
    prices: useMemo(
      () => Maybe.fromNullable(pricesState.data),
      [pricesState.data]
    ),
  });

  const gasWarningCheck = useGasWarningCheck({
    gasAmount: stakeExitTxGas,
    gasFeeToken: exitRequest.gasFeeToken,
    address: exitRequest.requestDto.addresses.address,
    additionalAddresses: exitRequest.requestDto.addresses.additionalAddresses,
    isStake: false,
  });

  const { t } = useTranslation();

  const formattedAmount = useMemo(() => formatNumber(amount), [amount]);

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
      actionExitGasEstimate.isLoading || gasWarningCheck.isLoading,
    isGasCheckWarning: !!gasWarningCheck.data,
    depositFee,
    managementFee,
    performanceFee,
    feeConfigLoading: feeConfigDto.isPending,
  };
};
