import type { RewardTokenDetails } from "@sk-widget/components/molecules/reward-token-details";
import { useSavedRef, useTokensPrices } from "@sk-widget/hooks";
import { useGasWarningCheck } from "@sk-widget/hooks/use-gas-warning-check";
import { getRewardTokenSymbols } from "@sk-widget/hooks/use-reward-token-details/get-reward-token-symbols";
import { useRegisterFooterButton } from "@sk-widget/pages/components/footer-outlet/context";
import { useUnstakeMachine } from "@sk-widget/pages/position-details/hooks/use-unstake-machine";
import type { MetaInfoProps } from "@sk-widget/pages/review/pages/common.page";
import { useExitStakeState } from "@sk-widget/providers/exit-stake-state";
import { bpsToAmount, formatNumber } from "@sk-widget/utils";
import { getGasFeeInUSD } from "@sk-widget/utils/formatters";
import {
  useActionExitGasEstimate,
  useYieldGetFeeConfiguration,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import type { ComponentProps } from "react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export const useUnstakeActionReview = () => {
  const exitRequest = useExitStakeState().unsafeCoerce();
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

  const depositFeeUsd = useMemo(
    () =>
      Maybe.fromNullable(feeConfigDto.data?.depositFeeBps)
        .map(BigNumber)
        .chain((v) => stakeExitTxGas.map((gas) => bpsToAmount(v, gas))),
    [feeConfigDto, stakeExitTxGas]
  );

  const managementFeeUsd = useMemo(
    () =>
      Maybe.fromNullable(feeConfigDto.data?.managementFeeBps)
        .map(BigNumber)
        .chain((v) => stakeExitTxGas.map((gas) => bpsToAmount(v, gas))),
    [feeConfigDto, stakeExitTxGas]
  );

  const performanceFeeUsd = useMemo(
    () =>
      Maybe.fromNullable(feeConfigDto.data?.performanceFeeBps)
        .map(BigNumber)
        .chain((v) => stakeExitTxGas.map((gas) => bpsToAmount(v, gas))),
    [feeConfigDto, stakeExitTxGas]
  );

  const gasWarningCheck = useGasWarningCheck({
    gasAmount: stakeExitTxGas,
    gasFeeToken: exitRequest.gasFeeToken,
    address: exitRequest.requestDto.addresses.address,
    additionalAddresses: exitRequest.requestDto.addresses.additionalAddresses,
    isStake: false,
  });

  const amount = useMemo(
    () =>
      Maybe.fromNullable(exitRequest.requestDto.args.amount).map(
        (val) => new BigNumber(val ?? 0)
      ),
    [exitRequest.requestDto.args.amount]
  );

  const { t } = useTranslation();

  const integrationData = useMemo(
    () => Maybe.of(exitRequest.integrationData),
    [exitRequest.integrationData]
  );
  const interactedToken = useMemo(
    () => Maybe.of(exitRequest.unstakeToken),
    [exitRequest.unstakeToken]
  );

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

  const [machine, send] = useUnstakeMachine();

  const unstakeIsLoading =
    machine.value === "unstakeCheck" ||
    machine.value === "unstakeGetVerificationMessageLoading" ||
    machine.value === "unstakeSignMessageLoading" ||
    machine.value === "unstakeLoading";

  const onContinueUnstakeSignMessage = () => send("CONTINUE_MESSAGE_SIGN");
  const onCloseUnstakeSignMessage = () => send("CANCEL_MESSAGE_SIGN");

  const onClick = () => {
    if (unstakeIsLoading) return;

    send("UNSTAKE");
  };

  useEffect(() => {
    if (machine.value === "unstakeDone" && exitRequest.actionDto.isJust()) {
      navigate("../steps", { relative: "path" });
    }
  }, [machine.value, exitRequest.actionDto, navigate]);

  const showUnstakeSignMessagePopup = machine.value === "unstakeShowPopup";

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
