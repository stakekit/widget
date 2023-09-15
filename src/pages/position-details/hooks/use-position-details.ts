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

export const usePositionDetails = () => {
  const { unstake } = useUnstakeOrPendingActionState();
  const dispatch = useUnstakeOrPendingActionDispatch();

  const params = useParams<{
    integrationId: string;
    defaultOrValidatorId: "default" | (string & {});
  }>();

  const integrationId = params.integrationId;
  const defaultOrValidatorId = params.defaultOrValidatorId ?? "default";

  const unstakeAmount = unstake.chain((u) => u.amount);

  const { position, isLoading } = usePositionData(integrationId);

  const validatorDetails = useMemo(
    () =>
      position.chain((p) =>
        defaultOrValidatorId === "default"
          ? Maybe.fromNullable(p.integrationData.metadata.provider).map(
              (v) => ({ name: v.name, logoURI: v.logoURI, address: v.id })
            )
          : List.find(
              (v) => v.address === defaultOrValidatorId,
              p.integrationData.validators
            ).map((v) => ({
              name: v.name,
              logoURI: v.image,
              address: v.address,
            }))
      ),
    [defaultOrValidatorId, position]
  );

  const { t } = useTranslation();

  const stakeType = position.map((p) => {
    switch (p.integrationData.metadata.type) {
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

  const positionsByValidatorOrDefault = position.map(
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
    position,
    defaultOrValidatorId
  );

  const stakedOrLiquidBalance = useStakedOrLiquidBalance(
    positionBalancesByType
  );

  const unstakeText = position.map((p) => {
    switch (p.integrationData.metadata.type) {
      case "staking":
      case "liquid-staking":
        return t("position_details.unstake");

      case "lending":
      case "vault":
      default:
        return t("position_details.withdraw");
    }
  });

  const canUnstake = position.map((p) => !!p.integrationData.args.exit);
  const canChangeAmount = position.map(
    (p) => !!p.integrationData.args.exit?.args?.amount?.required
  );

  const { maxEnterOrExitAmount, minEnterOrExitAmount } = useMaxMinYieldAmount({
    yieldOpportunity: position.map((p) => p.integrationData),
    type: "exit",
    positionBalancesByType,
  });

  // set initial unstake amount to 0
  useEffect(() => {
    position.ifJust((p) => {
      unstake.ifNothing(() => {
        dispatch({
          type: "unstake/amount/change",
          data: {
            integration: p.integrationData,
            amount: Maybe.of(new BigNumber(0)),
          },
        });
      });
    });
  }, [dispatch, integrationId, position, unstake]);

  // If changing unstake amount is not allowed, set `unstakeAmount` to staked amount
  // If `unstakeAmount` is less then min or greater than max, set in bounds
  useEffect(() => {
    stakedOrLiquidBalance
      .chain((sb) => unstakeAmount.map((ua) => ({ sb, ua })))
      .chain((val) => canChangeAmount.map((cca) => ({ ...val, cca })))
      .chain((val) => position.map((p) => ({ ...val, p })))
      .ifJust(({ sb, ua, cca, p }) => {
        const sbAmount = new BigNumber(sb.amount);
        if (!cca && !sbAmount.isEqualTo(ua)) {
          dispatch({
            type: "unstake/amount/change",
            data: {
              integration: p.integrationData,
              amount: Maybe.of(sbAmount),
            },
          });
        } else if (cca) {
          if (ua.isGreaterThan(maxEnterOrExitAmount)) {
            dispatch({
              type: "unstake/amount/change",
              data: {
                integration: p.integrationData,
                amount: Maybe.of(maxEnterOrExitAmount),
              },
            });
          } else if (ua.isLessThan(minEnterOrExitAmount)) {
            dispatch({
              type: "unstake/amount/change",
              data: {
                integration: p.integrationData,
                amount: Maybe.of(minEnterOrExitAmount),
              },
            });
          }
        }
      });
  }, [
    canChangeAmount,
    dispatch,
    integrationId,
    maxEnterOrExitAmount,
    minEnterOrExitAmount,
    stakedOrLiquidBalance,
    unstakeAmount,
    position,
  ]);

  const onUnstakeAmountChange = (value: Maybe<BigNumber>) => {
    position.ifJust((p) =>
      dispatch({
        type: "unstake/amount/change",
        data: { integration: p.integrationData, amount: value },
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
    stakedOrLiquidBalance
      .chain((sb) => position.map((p) => ({ p, sb })))
      .ifJust(({ p, sb }) => {
        dispatch({
          type: "unstake/amount/change",
          data: {
            integration: p.integrationData,
            amount: Maybe.of(
              getMaxAmount({
                gasEstimateTotal: new BigNumber(0),
                availableAmount: new BigNumber(sb.amount),
                integrationMaxLimit: Maybe.fromNullable(
                  p.integrationData.args.exit?.args?.amount?.maximum
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

  const unstakeAvailable = position.mapOrDefault(
    (p) => p.integrationData.status.exit,
    false
  );

  const unstakeDisabled =
    !unstakeAmountValid ||
    onStakeExit.isLoading ||
    onPendingAction.isLoading ||
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
    position
      .toEither(new Error("missing position"))
      .chain((p) =>
        preparePendingActionRequestDto({
          opportunityBalance,
          pendingActionDto,
          additionalAddresses,
          address,
          integration: p.integrationData,
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
        }))
      )
    );
  }, [positionBalancesByType]);

  return {
    position,
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
    isLoading: isLoading || prices.isLoading,
    onStakeExitIsLoading: onStakeExit.isLoading,
    onPendingActionClick,
    onPendingActionIsLoading: onPendingAction.isLoading,
    validatorDetails,
    pendingActions,
  };
};
