import { useEffect, useMemo } from "react";
import { Maybe } from "purify-ts";
import type { TokenDto } from "@stakekit/api-hooks";
import { equalTokens, getTokenPriceInUSD } from "../../../domain";
import BigNumber from "bignumber.js";
import { formatNumber } from "../../../utils";
import {
  useUnstakeOrPendingActionDispatch,
  useUnstakeOrPendingActionState,
} from "../state";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { usePendingActions } from "./use-pending-actions";
import { useUnstakeMachine } from "./use-unstake-machine";
import { useNavigate } from "react-router-dom";
import { useBaseToken } from "../../../hooks/use-base-token";
import { useStakeExitData } from "@sk-widget/hooks/use-stake-exit-data";

export const usePositionDetails = () => {
  const {
    unstakeAmount,
    integrationData,
    yieldOpportunity,
    positionBalances,
    reducedStakedOrLiquidBalance,
    positionBalancesByType,
    positionBalancePrices,
    unstakeAmountValid,
    unstakeToken,
    unstakeAmountError,
    canChangeUnstakeAmount,
  } = useUnstakeOrPendingActionState();

  const { stakeExitSession } = useStakeExitData();

  const dispatch = useUnstakeOrPendingActionDispatch();

  const trackEvent = useTrackEvent();

  const baseToken = useBaseToken(integrationData);

  const providersDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: positionBalances.data.map((b) => {
      return b.type === "validators" ? b.validatorsAddresses : [];
    }),
  });

  const canUnstake = integrationData.filter((d) => !!d.args.exit).isJust();

  const onUnstakeAmountChange = (value: BigNumber) =>
    dispatch({ type: "unstake/amount/change", data: value });

  const unstakeFormattedAmount = useMemo(
    () =>
      Maybe.fromRecord({
        prices: Maybe.fromNullable(positionBalancePrices.data),
        reducedStakedOrLiquidBalance,
        baseToken,
      })
        .map((val) =>
          getTokenPriceInUSD({
            amount: unstakeAmount,
            token: val.reducedStakedOrLiquidBalance.token,
            prices: val.prices,
            pricePerShare: val.reducedStakedOrLiquidBalance.pricePerShare,
            baseToken: val.baseToken,
          })
        )
        .mapOrDefault((v) => `$${formatNumber(v, 2)}`, ""),
    [
      positionBalancePrices.data,
      reducedStakedOrLiquidBalance,
      unstakeAmount,
      baseToken,
    ]
  );

  const onMaxClick = () => {
    trackEvent("positionDetailsPageMaxClicked", {
      yieldId: integrationData.map((v) => v.id).extract(),
    });

    dispatch({ type: "unstake/amount/max" });
  };

  const unstakeAvailable = integrationData.mapOrDefault(
    (d) => d.status.exit,
    false
  );

  const {
    onPendingActionAmountChange,
    pendingActions,
    onPendingAction,
    onPendingActionClick,
    onValidatorsSubmit,
    validatorAddressesHandling,
  } = usePendingActions();

  const [machine, send] = useUnstakeMachine();

  const navigate = useNavigate();

  const unstakeIsLoading =
    machine.value === "unstakeCheck" ||
    machine.value === "unstakeGetVerificationMessageLoading" ||
    machine.value === "unstakeSignMessageLoading" ||
    machine.value === "unstakeLoading";

  const onUnstakeClick = () => {
    if (unstakeIsLoading) return;

    send("UNSTAKE");
  };

  useEffect(() => {
    if (machine.value === "unstakeDone" && stakeExitSession.isJust()) {
      navigate("unstake/review");
    }
  }, [machine.value, navigate, stakeExitSession]);

  const onContinueUnstakeSignMessage = () => send("CONTINUE_MESSAGE_SIGN");
  const onCloseUnstakeSignMessage = () => send("CANCEL_MESSAGE_SIGN");

  const showUnstakeSignMessagePopup = machine.value === "unstakeShowPopup";

  const liquidTokensToNativeConversion = useMemo(
    () =>
      Maybe.fromRecord({
        integrationData,
        positionBalancesByType,
        baseToken,
      }).map((v) =>
        [...v.positionBalancesByType.values()].reduce((acc, curr) => {
          curr
            .filter(
              (yb) =>
                !yb.token.isPoints &&
                yb.pricePerShare &&
                !equalTokens(yb.token, v.baseToken)
            )
            .forEach((yb) => {
              acc.set(
                yb.token.symbol,
                `1 ${yb.token.symbol} = ${formatNumber(
                  new BigNumber(yb.pricePerShare)
                )} ${v.baseToken.symbol}`
              );
            });

          return acc;
        }, new Map<TokenDto["symbol"], string>())
      ),
    [integrationData, positionBalancesByType, baseToken]
  );

  const unstakeDisabled =
    !unstakeAmountValid ||
    unstakeIsLoading ||
    onPendingAction.isPending ||
    yieldOpportunity.isLoading ||
    !unstakeAvailable;

  const isLoading =
    positionBalances.isLoading ||
    positionBalancePrices.isLoading ||
    yieldOpportunity.isLoading;

  return {
    integrationData,
    reducedStakedOrLiquidBalance,
    positionBalancesByType,
    canUnstake,
    unstakeAmount,
    onUnstakeAmountChange,
    unstakeFormattedAmount,
    onMaxClick,
    canChangeUnstakeAmount,
    onUnstakeClick,
    onContinueUnstakeSignMessage,
    onCloseUnstakeSignMessage,
    showUnstakeSignMessagePopup,
    unstakeDisabled,
    isLoading,
    unstakeIsLoading,
    onPendingActionClick,
    providersDetails,
    pendingActions,
    liquidTokensToNativeConversion,
    validatorAddressesHandling,
    onValidatorsSubmit,
    onPendingActionAmountChange,
    unstakeToken,
    unstakeAmountError,
  };
};
