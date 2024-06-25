import { useUpdateEffect } from "@sk-widget/hooks/use-update-effect";
import { useStakeExitRequestDto } from "@sk-widget/pages/position-details/hooks/use-stake-exit-request-dto";
import {
  useExitStakeState,
  useExitStakeStateDispatch,
} from "@sk-widget/providers/exit-stake-state";
import type { TokenDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { equalTokens, getTokenPriceInUSD } from "../../../domain";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { useBaseToken } from "../../../hooks/use-base-token";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { formatNumber } from "../../../utils";
import {
  useUnstakeOrPendingActionDispatch,
  useUnstakeOrPendingActionState,
} from "../state";
import { usePendingActions } from "./use-pending-actions";

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

  const navigate = useNavigate();

  const stakeExitRequestDto = useStakeExitRequestDto();
  const exitDispatch = useExitStakeStateDispatch();
  const exitRequest = useExitStakeState();

  const onUnstakeClick = () => {
    Maybe.fromRecord({
      stakeExitRequestDto,
      integrationData,
      unstakeToken,
    }).ifJust((val) => {
      exitDispatch(
        Maybe.of({
          actionDto: Maybe.empty(),
          gasFeeToken: val.stakeExitRequestDto.gasFeeToken,
          integrationData: val.integrationData,
          requestDto: val.stakeExitRequestDto.dto,
          unstakeAmount,
          unstakeToken: val.unstakeToken,
        })
      );
    });
  };

  useUpdateEffect(() => {
    if (exitRequest.isJust()) {
      navigate("unstake/review");
    }
  }, [exitRequest]);

  const positionLabel = positionBalances.data.chainNullable(
    (b) => b.balances.find((b) => b.label)?.label
  );

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
        .mapOrDefault((v) => `$${formatNumber(v, 6)}`, ""),
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
    onPendingActionClick,
    onValidatorsSubmit,
    validatorAddressesHandling,
  } = usePendingActions();

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
    !unstakeAmountValid || yieldOpportunity.isLoading || !unstakeAvailable;

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
    unstakeDisabled,
    isLoading,
    onPendingActionClick,
    providersDetails,
    pendingActions,
    liquidTokensToNativeConversion,
    validatorAddressesHandling,
    onValidatorsSubmit,
    onPendingActionAmountChange,
    unstakeToken,
    unstakeAmountError,
    positionLabel,
  };
};
