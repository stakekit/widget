import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { Left, Maybe, Right } from "purify-ts";
import { useTranslation } from "react-i18next";
import { usePrices } from "../../../hooks/api/use-prices";
import {
  PendingActionDto,
  PriceRequestDto,
  TokenDto,
  ValidatorDto,
  YieldBalanceDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { config } from "../../../config";
import { tokenToTokenDto } from "../../../utils/mappers";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
  getBaseToken,
  getMaxAmount,
  getTokenPriceInUSD,
} from "../../../domain";
import BigNumber from "bignumber.js";
import { formatNumber } from "../../../utils";
import { useStakedOrLiquidBalance } from "../../../hooks/use-staked-or-liquid-balance";
import { useMaxMinYieldAmount } from "../../../hooks/use-max-min-yield-amount";
import { useOnStakeExit } from "./use-on-stake-exit";
import { useOnPendingAction } from "./use-on-pending-action";
import {
  useUnstakeOrPendingActionDispatch,
  useUnstakeOrPendingActionState,
} from "../../../state/unstake-or-pending-action";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";
import { preparePendingActionRequestDto } from "./utils";
import { usePositionBalanceByType } from "../../../hooks/use-position-balance-by-type";
import { useYieldOpportunity } from "../../../hooks/api/use-yield-opportunity";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useForceMaxAmount } from "../../../hooks/use-force-max-amount";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useTrackEvent } from "../../../hooks/tracking/use-track-event";
import { usePositionBalances } from "../../../hooks/use-position-balances";
import { useValidatorAddressesHandling } from "./use-validator-addresses-handling";
import { List } from "purify-ts";
import { useSavedRef } from "../../../hooks";

export const usePositionDetails = () => {
  const { unstake } = useUnstakeOrPendingActionState();
  const dispatch = useUnstakeOrPendingActionDispatch();

  const trackEvent = useTrackEvent();

  const { integrationId, balanceId, pendingActionType } = useParams<{
    integrationId: string;
    balanceId: string;
    pendingActionType?: PendingActionDto["type"];
  }>();

  const yieldOpportunity = useYieldOpportunity(integrationId);

  const integrationData = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const unstakeAmount = unstake.chain((u) => u.amount);

  const positionBalances = usePositionBalances({ balanceId, integrationId });

  const providersDetails = useProvidersDetails({
    integrationData,
    validatorsAddresses: positionBalances.data.map((b) =>
      b.type === "validators" ? b.validatorsAddresses : []
    ),
  });

  const { t } = useTranslation();

  const stakeType = integrationData.map((d) => {
    switch (d.metadata.type) {
      case "staking":
        return t("position_details.staked");

      case "liquid-staking":
        return t("position_details.liquid_staked");

      case "lending":
      case "vault":
      default:
        return t("position_details.deposited");
    }
  });

  const prices = usePrices(
    useMemo(
      () =>
        positionBalances.data
          .map<PriceRequestDto>((val) => ({
            currency: config.currency,
            tokenList: val.balances.flatMap((v, i) =>
              i === 0
                ? [tokenToTokenDto(getBaseToken(v.token)), v.token]
                : [v.token]
            ),
          }))
          .extractNullable(),
      [positionBalances]
    )
  );

  /**
   * @summary Position balance by type
   */
  const positionBalancesByType = usePositionBalanceByType(
    positionBalances.data
  );

  const stakedOrLiquidBalances = useStakedOrLiquidBalance(
    positionBalancesByType
  );

  const reducedStakedOrLiquidBalance = useMemo(
    () =>
      stakedOrLiquidBalances.map((b) =>
        b.reduce(
          (acc, next) => {
            acc.amount = acc.amount.plus(new BigNumber(next.amount));
            acc.token = next.token;
            acc.pricePerShare = next.pricePerShare;

            return acc;
          },
          {
            amount: new BigNumber(0),
            token: b[0].token,
            pricePerShare: b[0].pricePerShare,
          }
        )
      ),
    [stakedOrLiquidBalances]
  );

  const forceMax = useForceMaxAmount({
    type: "exit",
    integration: integrationData,
  });

  const unstakeText = integrationData.map((d) => {
    switch (d.metadata.type) {
      case "staking":
      case "liquid-staking":
        return t("position_details.unstake");

      case "lending":
      case "vault":
      default:
        return t("position_details.withdraw");
    }
  });

  const canUnstake = integrationData.map((d) => !!d.args.exit);
  const canChangeAmount = integrationData.map(
    (d) => !!(!forceMax && d.args.exit?.args?.amount?.required)
  );

  const { maxEnterOrExitAmount, minEnterOrExitAmount } = useMaxMinYieldAmount({
    yieldOpportunity: integrationData,
    type: "exit",
    positionBalancesByType,
  });

  // set initial unstake amount to 0
  useEffect(() => {
    integrationData.ifJust((d) => {
      unstake.ifNothing(() => {
        dispatch({
          type: "unstake/amount/change",
          data: {
            integration: d,
            amount: Maybe.of(new BigNumber(0)),
          },
        });
      });
    });
  }, [dispatch, integrationData, unstake]);

  // If changing unstake amount is not allowed, set `unstakeAmount` to staked amount
  // If `unstakeAmount` is less then min or greater than max, set in bounds
  useEffect(() => {
    Maybe.fromRecord({
      reducedStakedOrLiquidBalance,
      unstakeAmount,
      canChangeAmount,
      integrationData,
    }).ifJust((val) => {
      if (
        (!val.canChangeAmount || forceMax) &&
        !val.reducedStakedOrLiquidBalance.amount.isEqualTo(val.unstakeAmount)
      ) {
        dispatch({
          type: "unstake/amount/change",
          data: {
            integration: val.integrationData,
            amount: Maybe.of(val.reducedStakedOrLiquidBalance.amount),
          },
        });
      } else if (val.canChangeAmount) {
        if (val.unstakeAmount.isGreaterThan(maxEnterOrExitAmount)) {
          dispatch({
            type: "unstake/amount/change",
            data: {
              integration: val.integrationData,
              amount: Maybe.of(maxEnterOrExitAmount),
            },
          });
        } else if (val.unstakeAmount.isLessThan(minEnterOrExitAmount)) {
          dispatch({
            type: "unstake/amount/change",
            data: {
              integration: val.integrationData,
              amount: Maybe.of(minEnterOrExitAmount),
            },
          });
        }
      }
    });
  }, [
    canChangeAmount,
    dispatch,
    forceMax,
    integrationData,
    maxEnterOrExitAmount,
    minEnterOrExitAmount,
    reducedStakedOrLiquidBalance,
    unstakeAmount,
  ]);

  const onUnstakeAmountChange = (value: Maybe<BigNumber>) => {
    integrationData.ifJust((d) =>
      dispatch({
        type: "unstake/amount/change",
        data: { integration: d, amount: value },
      })
    );
  };

  const unstakeFormattedAmount = useMemo(
    () =>
      Maybe.fromRecord({
        prices: Maybe.fromNullable(prices.data),
        reducedStakedOrLiquidBalance,
        unstakeAmount,
      })
        .map((val) =>
          getTokenPriceInUSD({
            amount: val.unstakeAmount,
            token: val.reducedStakedOrLiquidBalance.token,
            prices: val.prices,
            pricePerShare: val.reducedStakedOrLiquidBalance.pricePerShare,
          })
        )
        .mapOrDefault((v) => `$${formatNumber(v, 2)}`, ""),
    [prices.data, reducedStakedOrLiquidBalance, unstakeAmount]
  );

  const onMaxClick = () => {
    trackEvent("positionDetailsPageMaxClicked", {
      yieldId: integrationData.map((v) => v.id).extract(),
    });

    Maybe.fromRecord({
      reducedStakedOrLiquidBalance,
      integrationData,
    }).ifJust((val) => {
      dispatch({
        type: "unstake/amount/change",
        data: {
          integration: val.integrationData,
          amount: Maybe.of(
            getMaxAmount({
              gasEstimateTotal: new BigNumber(0),
              availableAmount: val.reducedStakedOrLiquidBalance.amount,
              integrationMaxLimit: Maybe.fromNullable(
                val.integrationData.args.exit?.args?.amount?.maximum
              )
                .map((a) => new BigNumber(a))
                .orDefault(new BigNumber(Number.POSITIVE_INFINITY)),
            })
          ),
        },
      });
    });
  };

  const navigate = useNavigate();

  const onStakeExit = useOnStakeExit();
  const stakeExitRequestDto = useStakeExitRequestDto({
    balance: stakedOrLiquidBalances,
  });

  const onPendingAction = useOnPendingAction();

  const unstakeAmountValid = unstake
    .chain((u) => u.amount)
    .mapOrDefault(
      (a) =>
        a.isGreaterThanOrEqualTo(minEnterOrExitAmount) &&
        a.isLessThanOrEqualTo(maxEnterOrExitAmount) &&
        !a.isZero(),
      false
    );

  const unstakeAvailable = integrationData.mapOrDefault(
    (d) => d.status.exit,
    false
  );

  const unstakeDisabled =
    !unstakeAmountValid ||
    onStakeExit.isPending ||
    onPendingAction.isPending ||
    yieldOpportunity.isLoading ||
    !unstakeAvailable;

  const onUnstakeClick = () => {
    trackEvent("unstakeClicked", {
      yieldId: integrationData.map((v) => v.id).extract(),
      amount: unstake
        .chain((v) => v.amount)
        .map((v) => v.toString())
        .extract(),
    });

    onStakeExit.mutateAsync({ stakeRequestDto: stakeExitRequestDto }).then(() =>
      navigate(`../../../unstake/${integrationId}/${balanceId}/review`, {
        relative: "path",
      })
    );
  };

  const pendingActions = useMemo(
    () =>
      positionBalancesByType.map((pbbt) =>
        [...pbbt.values()].flatMap((val) =>
          val.flatMap((v) =>
            v.pendingActions.map((pa) => ({
              pendingActionDto: pa,
              yieldBalance: v,
              isLoading:
                onPendingAction.variables?.pendingActionRequestDto
                  .passthrough === pa.passthrough &&
                onPendingAction.variables?.pendingActionRequestDto.type ===
                  pa.type &&
                onPendingAction.isPending,
            }))
          )
        )
      ),
    [
      onPendingAction.isPending,
      onPendingAction.variables?.pendingActionRequestDto,
      positionBalancesByType,
    ]
  );

  const { additionalAddresses, address } = useSKWallet();

  const validatorAddressesHandling = useValidatorAddressesHandling();

  const validatorAddressesHandlingRef = useSavedRef(validatorAddressesHandling);

  const selectValidatorModalShown = useRef(false);

  // On deep link, find pending action with validators requirement
  // and open validator selection modal
  useEffect(() => {
    if (selectValidatorModalShown.current) return;

    Maybe.fromNullable(pendingActionType)
      .chain((val) =>
        pendingActions.chain((pa) =>
          List.find(
            (p) =>
              p.pendingActionDto.type === val &&
              !!(
                PAMultiValidatorsRequired(p.pendingActionDto) ||
                PASingleValidatorRequired(p.pendingActionDto)
              ),
            pa
          )
        )
      )
      .ifJust((val) => {
        selectValidatorModalShown.current = true;
        validatorAddressesHandlingRef.current.openModal({
          pendingActionDto: val.pendingActionDto,
          yieldBalance: val.yieldBalance,
        });
      });
  }, [pendingActionType, pendingActions, validatorAddressesHandlingRef]);

  const onPendingActionClick = ({
    yieldBalance,
    pendingActionDto,
  }: {
    pendingActionDto: PendingActionDto;
    yieldBalance: YieldBalanceDto;
  }) => {
    trackEvent("pendingActionClicked", {
      yieldId: integrationData.map((v) => v.id).extract(),
      type: pendingActionDto.type,
    });

    if (
      PAMultiValidatorsRequired(pendingActionDto) ||
      PASingleValidatorRequired(pendingActionDto)
    ) {
      return validatorAddressesHandling.openModal({
        pendingActionDto,
        yieldBalance,
      });
    }

    integrationData
      .toEither(new Error("missing integration data"))
      .ifRight((val) =>
        continuePendingActionFlow({
          integrationData: val,
          pendingActionDto,
          yieldBalance,
          selectedValidators: [],
        })
      );
  };

  const onValidatorsSubmit = (selectedValidators: string[]) => {
    return integrationData
      .toEither(new Error("missing integration data"))
      .chain((val) => {
        if (!validatorAddressesHandling.showValidatorsModal) {
          return Left(
            new Error("missing validatorAddressesHandling.showValidatorsModal")
          );
        } else if (!selectedValidators.length) {
          return Left(new Error("selectedValidators is empty"));
        }

        const { pendingActionDto, yieldBalance } = validatorAddressesHandling;

        return Right({
          yieldDto: val,
          selectedValidators,
          pendingActionDto,
          yieldBalance,
        });
      })
      .ifRight(
        ({ selectedValidators, pendingActionDto, yieldBalance, yieldDto }) => {
          trackEvent("validatorsSubmitted", {
            yieldId: yieldDto.id,
            type: pendingActionDto.type,
            validators: selectedValidators,
          });

          validatorAddressesHandling.closeModal();

          continuePendingActionFlow({
            integrationData: yieldDto,
            pendingActionDto,
            yieldBalance,
            selectedValidators,
          });
        }
      );
  };

  const continuePendingActionFlow = ({
    integrationData,
    pendingActionDto,
    yieldBalance,
    selectedValidators,
  }: {
    integrationData: YieldDto;
    pendingActionDto: PendingActionDto;
    yieldBalance: YieldBalanceDto;
    selectedValidators: ValidatorDto["address"][];
  }) => {
    preparePendingActionRequestDto({
      yieldBalance,
      pendingActionDto,
      additionalAddresses,
      address,
      integration: integrationData,
      selectedValidators,
    }).ifRight((val) =>
      onPendingAction
        .mutateAsync({ pendingActionRequestDto: val, yieldBalance })
        .then(() =>
          navigate(`/pending-action/${integrationId}/${balanceId}/review`)
        )
    );
  };

  const error = onStakeExit.isError || onPendingAction.isError;

  const liquidTokensToNativeConversion = useMemo(
    () =>
      Maybe.fromRecord({ integrationData, positionBalancesByType })
        .chain((val) =>
          Maybe.fromPredicate(
            () => val.integrationData.metadata.type === "liquid-staking",
            val
          )
        )
        .map((v) =>
          [...v.positionBalancesByType.values()].reduce((acc, curr) => {
            curr.forEach((yb) =>
              acc.set(
                yb.token.symbol,
                `1 ${yb.token.symbol} = ${formatNumber(
                  new BigNumber(yb.pricePerShare)
                )} ${v.integrationData.metadata.token.symbol}`
              )
            );

            return acc;
          }, new Map<TokenDto["symbol"], string>())
        ),
    [integrationData, positionBalancesByType]
  );

  const isLoading =
    positionBalances.isLoading ||
    prices.isLoading ||
    yieldOpportunity.isLoading;

  return {
    integrationData,
    stakeType,
    reducedStakedOrLiquidBalance,
    positionBalancesByType,
    unstakeText,
    canUnstake,
    unstakeAmount,
    onUnstakeAmountChange,
    unstakeFormattedAmount,
    onMaxClick,
    canChangeAmount,
    onUnstakeClick,
    error,
    unstakeDisabled,
    isLoading,
    onStakeExitIsLoading: onStakeExit.isPending,
    onPendingActionClick,
    providersDetails,
    pendingActions,
    liquidTokensToNativeConversion,
    validatorAddressesHandling,
    onValidatorsSubmit,
  };
};
