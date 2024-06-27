import { isForceMaxAmount } from "@sk-widget/domain/types/stake";
import { useUpdateEffect } from "@sk-widget/hooks/use-update-effect";
import { useStakeExitRequestDto } from "@sk-widget/pages/position-details/hooks/use-stake-exit-request-dto";
import {
  useExitStakeState,
  useExitStakeStateDispatch,
} from "@sk-widget/providers/exit-stake-state";
import type { TokenDto } from "@stakekit/api-hooks";
import { useMutation } from "@tanstack/react-query";
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
    unstakeIsLessThanMin,
  } = useUnstakeOrPendingActionState();

  const navigate = useNavigate();

  const stakeExitRequestDto = useStakeExitRequestDto();
  const exitDispatch = useExitStakeStateDispatch();
  const exitRequest = useExitStakeState();

  const unstakeMaxAmount = useMemo(
    () =>
      integrationData
        .chainNullable((val) => val.args.exit?.args?.amount)
        .filter((val) => !isForceMaxAmount(val))
        .chainNullable((val) => val.maximum),
    [integrationData]
  );

  const unstakeMinAmount = useMemo(
    () =>
      integrationData
        .chainNullable((val) => val.args.exit?.args?.amount)
        .filter((val) => !isForceMaxAmount(val))
        .chainNullable((val) => val.minimum)
        .filter((val) => new BigNumber(val).isGreaterThan(0)),
    [integrationData]
  );

  const onClickHandler = useMutation({
    mutationKey: [unstakeAmount.toString()],
    mutationFn: async () => {
      if (!unstakeAmountValid) throw new Error("Invalid amount");

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

      return null;
    },
  });

  const onUnstakeClick = onClickHandler.mutate;

  const _unstakeAmountError = onClickHandler.isError || unstakeAmountError;

  useUpdateEffect(() => {
    if (exitRequest.isJust()) {
      navigate("unstake/review");
    }
  }, [exitRequest]);

  const positionLabel = useMemo(
    () =>
      positionBalances.data.chainNullable(
        (b) => b.balances.find((b) => b.label)?.label
      ),
    [positionBalances.data]
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

  const unstakeDisabled = yieldOpportunity.isLoading || !unstakeAvailable;

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
    positionLabel,
    unstakeAmountError: _unstakeAmountError,
    unstakeMaxAmount,
    unstakeMinAmount,
    unstakeIsLessThanMin,
  };
};
