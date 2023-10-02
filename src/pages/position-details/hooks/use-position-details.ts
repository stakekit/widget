import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { List, Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { usePrices } from "../../../hooks/api/use-prices";
import {
  PendingActionDto,
  PriceRequestDto,
  YieldBalanceDto,
} from "@stakekit/api-hooks";
import { config } from "../../../config";
import { tokenToTokenDto } from "../../../utils/mappers";
import {
  getBaseToken,
  getMaxAmount,
  getTokenPriceInUSD,
} from "../../../domain";
import { Token } from "@stakekit/common";
import BigNumber from "bignumber.js";
import { formatTokenBalance } from "../../../utils";
import { usePositionData } from "../../../hooks/use-position-data";
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
import { useSKWallet } from "../../../hooks/wallet/use-sk-wallet";
import { usePositionBalanceByType } from "../../../hooks/use-position-balance-by-type";
import { useYieldOpportunity } from "../../../hooks/api/use-yield-opportunity";

export const usePositionDetails = () => {
  const { unstake } = useUnstakeOrPendingActionState();
  const dispatch = useUnstakeOrPendingActionDispatch();

  const params = useParams<{
    integrationId: string;
    defaultOrValidatorId: "default" | (string & {});
  }>();

  const integrationId = params.integrationId;
  const defaultOrValidatorId = params.defaultOrValidatorId ?? "default";

  const yieldOpportunity = useYieldOpportunity(integrationId);

  const integrationData = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const unstakeAmount = unstake.chain((u) => u.amount);

  const positionData = usePositionData(integrationId);

  const validatorDetails = useMemo(
    () =>
      positionData.position.chain((p) =>
        defaultOrValidatorId === "default"
          ? integrationData
              .chainNullable((d) => d.metadata.provider)
              .map((v) => ({ name: v.name, logoURI: v.logoURI, address: v.id }))
          : integrationData
              .map((d) => d.validators)
              .chain((val) =>
                List.find((v) => v.address === defaultOrValidatorId, val)
              )
              .map((v) => ({
                name: v.name,
                logoURI: v.image,
                address: v.address,
              }))
      ),
    [defaultOrValidatorId, integrationData, positionData.position]
  );

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

  const positionsByValidatorOrDefault = positionData.position.map(
    (p) => p.balanceData[defaultOrValidatorId]
  );

  const prices = usePrices(
    positionsByValidatorOrDefault
      .chain((val) => List.head(val))
      .map<PriceRequestDto>((sb) => ({
        currency: config.currency,
        tokenList: [sb.token, tokenToTokenDto(getBaseToken(sb.token as Token))],
      }))
      .extractNullable()
  );

  /**
   * @summary Position balance by type
   */
  const positionBalancesByType = usePositionBalanceByType(
    positionData.position,
    defaultOrValidatorId
  );

  const stakedOrLiquidBalance = useStakedOrLiquidBalance(
    positionBalancesByType
  );

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
    (d) => !!d.args.exit?.args?.amount?.required
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
      stakedOrLiquidBalance,
      unstakeAmount,
      canChangeAmount,
      integrationData,
    }).ifJust((val) => {
      const sbAmount = new BigNumber(val.stakedOrLiquidBalance.amount);

      if (!val.canChangeAmount && !sbAmount.isEqualTo(val.unstakeAmount)) {
        dispatch({
          type: "unstake/amount/change",
          data: {
            integration: val.integrationData,
            amount: Maybe.of(sbAmount),
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
    integrationData,
    maxEnterOrExitAmount,
    minEnterOrExitAmount,
    stakedOrLiquidBalance,
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

  const unstakeFormattedAmount = Maybe.fromNullable(prices.data)
    .chain((prices) => stakedOrLiquidBalance.map((sb) => ({ sb, prices })))
    .chain((val) => unstakeAmount.map((sa) => ({ ...val, sa })))
    .map((val) =>
      getTokenPriceInUSD({
        amount: val.sa,
        token: val.sb.token as Token,
        prices: val.prices,
        pricePerShare: val.sb.pricePerShare,
      })
    )
    .mapOrDefault((v) => `$${formatTokenBalance(v, 2)}`, "");

  const onMaxClick = () => {
    Maybe.fromRecord({ stakedOrLiquidBalance, integrationData }).ifJust(
      (val) => {
        dispatch({
          type: "unstake/amount/change",
          data: {
            integration: val.integrationData,
            amount: Maybe.of(
              getMaxAmount({
                gasEstimateTotal: new BigNumber(0),
                availableAmount: new BigNumber(
                  val.stakedOrLiquidBalance.amount
                ),
                integrationMaxLimit: Maybe.fromNullable(
                  val.integrationData.args.exit?.args?.amount?.maximum
                )
                  .map((a) => new BigNumber(a))
                  .orDefault(new BigNumber(Number.POSITIVE_INFINITY)),
              })
            ),
          },
        });
      }
    );
  };

  const navigate = useNavigate();

  const onStakeExit = useOnStakeExit();
  const stakeExitRequestDto = useStakeExitRequestDto({
    balance: stakedOrLiquidBalance,
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
    onStakeExit.isLoading ||
    onPendingAction.isLoading ||
    yieldOpportunity.isLoading ||
    !unstakeAvailable;

  const onUnstakeClick = () => {
    onStakeExit
      .mutateAsync({ stakeRequestDto: stakeExitRequestDto })
      .then(() =>
        navigate(
          `../../../unstake/${integrationId}/${defaultOrValidatorId}/review`,
          { relative: "path" }
        )
      );
  };

  const { additionalAddresses, address } = useSKWallet();

  const onPendingActionClick = ({
    opportunityBalance,
    pendingActionDto,
  }: {
    pendingActionDto: PendingActionDto;
    opportunityBalance: YieldBalanceDto;
  }) => {
    integrationData
      .toEither(new Error("missing integration data"))
      .chain((d) =>
        preparePendingActionRequestDto({
          opportunityBalance,
          pendingActionDto,
          additionalAddresses,
          address,
          integration: d,
        })
      )
      .ifRight((pendingActionRequestDto) => {
        onPendingAction
          .mutateAsync({ pendingActionRequestDto })
          .then(() =>
            navigate(
              `../../../pending-action/${integrationId}/${defaultOrValidatorId}/review`,
              { relative: "path" }
            )
          );
      });
  };

  const error = onStakeExit.isError || onPendingAction.isError;

  const pendingActions = useMemo(() => {
    return positionBalancesByType.map((pbbt) =>
      [...pbbt.values()].flatMap((val) =>
        val.pendingActions.map((pa) => ({
          pendingActionDto: pa,
          opportunityBalance: val,
          isLoading:
            onPendingAction.variables?.pendingActionRequestDto.passthrough ===
              pa.passthrough &&
            onPendingAction.variables?.pendingActionRequestDto.type ===
              pa.type &&
            onPendingAction.isLoading,
        }))
      )
    );
  }, [
    onPendingAction.isLoading,
    onPendingAction.variables?.pendingActionRequestDto,
    positionBalancesByType,
  ]);

  const isLoading =
    positionData.isLoading || prices.isLoading || yieldOpportunity.isLoading;

  return {
    integrationData,
    stakeType,
    stakedOrLiquidBalance,
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
    onStakeExitIsLoading: onStakeExit.isLoading,
    onPendingActionClick,
    validatorDetails,
    pendingActions,
  };
};
