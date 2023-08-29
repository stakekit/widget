import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { List, Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { usePrices } from "../../../hooks/api/use-prices";
import { PriceRequestDto } from "@stakekit/api-hooks";
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
import { useOnClaim } from "./use-on-claim";
import {
  useUnstakeOrClaimDispatch,
  useUnstakeOrClaimState,
} from "../../../state/unstake-or-claim";
import { useStakeExitRequestDto } from "./use-stake-exit-request-dto";
import { useStakeClaimRequestDto } from "./use-stake-claim-request.dto";

export const usePositionDetails = () => {
  const { unstake, claim } = useUnstakeOrClaimState();
  const dispatch = useUnstakeOrClaimDispatch();

  const params = useParams<{
    integrationId: string;
    defaultOrValidatorId: "default" | (string & {});
  }>();

  const integrationId = params.integrationId;
  const defaultOrValidatorId = params.defaultOrValidatorId ?? "default";

  const unstakeAmount = unstake.chain((u) => u.amount);

  const { position, isLoading } = usePositionData(integrationId);

  const { t } = useTranslation();

  const stakeType = position.map((p) => {
    switch (p.integrationData.config.type) {
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

  const balance = useStakedOrLiquidBalance(position, defaultOrValidatorId);

  const rewardsBalance = useMemo(
    () =>
      position.chain((p) =>
        List.find(
          (b) => b.type === "rewards",
          p.balanceData[defaultOrValidatorId]
        )
      ),
    [position, defaultOrValidatorId]
  );

  const prices = usePrices(
    balance
      .map((sb): PriceRequestDto => {
        return {
          currency: config.currency,
          tokenList: [
            sb.token,
            tokenToTokenDto(getBaseToken(sb.token as Token)),
          ],
        };
      })
      .extractNullable()
  );

  const stakedPrice = useMemo(
    () =>
      balance
        .chain((sb) => Maybe.fromNullable(prices.data).map((p) => ({ p, sb })))
        .map(({ p, sb }) =>
          getTokenPriceInUSD({
            amount: sb.amount,
            prices: p,
            token: sb.token as Token,
          })
        ),
    [prices.data, balance]
  );

  const rewardsPrice = useMemo(
    () =>
      rewardsBalance
        .chain((rb) => Maybe.fromNullable(prices.data).map((p) => ({ p, rb })))
        .map(({ p, rb }) =>
          getTokenPriceInUSD({
            amount: rb.amount,
            prices: p,
            token: rb.token as Token,
          })
        ),
    [prices.data, rewardsBalance]
  );

  const claimAvailableRewards = useMemo(
    () =>
      rewardsBalance.chain((rb) =>
        List.find((pa) => pa.type === "CLAIM_REWARDS", rb.pendingActions)
      ),
    [rewardsBalance]
  );

  const unstakeText = position.map((p) => {
    switch (p.integrationData.config.type) {
      case "staking":
      case "liquid-staking":
        return t("position_details.unstake");

      case "lending":
      case "vault":
      default:
        return t("position_details.withdraw");
    }
  });

  const hasUnstakeAction = position.map((p) => !!p.integrationData.args.exit);

  const canChangeAmount = position.map(
    (p) => !!p.integrationData.args.exit?.args?.amount?.required
  );

  const { maxEnterOrExitAmount, minEnterOrExitAmount } = useMaxMinYieldAmount({
    yieldOpportunity: position.map((p) => p.integrationData),
    type: "exit",
    balance,
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

  /**
   *
   * @summary Set claim state
   */
  useEffect(() => {
    claim.ifNothing(() => {
      claimAvailableRewards
        .chain((car) => position.map((p) => ({ car, p })))
        .chain((val) => rewardsBalance.map((rb) => ({ ...val, rb })))
        .ifJust(({ car, p, rb }) => {
          dispatch({
            type: "claim/set",
            data: {
              integration: p.integrationData,
              amount: rb.amount,
              passthrough: car.passthrough,
              type: car.type,
            },
          });
        });
    });
  }, [claim, claimAvailableRewards, dispatch, position, rewardsBalance]);

  // If changing unstake amount is not allowed, set `unstakeAmount` to staked amount
  // If `unstakeAmount` is less then min or greater than max, set in bounds
  useEffect(() => {
    balance
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
    balance,
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
    .chain((prices) => balance.map((sb) => ({ sb, prices })))
    .chain((val) => unstakeAmount.map((sa) => ({ ...val, sa })))
    .map((val) =>
      getTokenPriceInUSD({
        amount: val.sa,
        token: val.sb.token as Token,
        prices: val.prices,
      })
    )
    .mapOrDefault((v) => `$${formatTokenBalance(v, 2)}`, "");

  const onMaxClick = () => {
    balance
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
  const stakeExitRequestDto = useStakeExitRequestDto({ balance });

  const onClaim = useOnClaim();
  const stakeClaimRequestDto = useStakeClaimRequestDto({
    balance,
    claimAvailableRewards,
    rewardsBalance,
  });

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
    onClaim.isLoading ||
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

  const onClaimClick = () => {
    onClaim
      .mutateAsync({ stakeRequestDto: stakeClaimRequestDto })
      .then(() =>
        navigate(
          `../../../claim/${integrationId}/${defaultOrValidatorId}/review`,
          { relative: "path" }
        )
      );
  };

  const error = onStakeExit.isError || onClaim.isError;

  return {
    position,
    stakeType,
    balance,
    stakedPrice,
    rewardsBalance,
    rewardsPrice,
    claimAvailableRewards,
    unstakeText,
    hasUnstakeAction,
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
    onClaimClick,
    onClaimIsLoading: onClaim.isLoading,
  };
};
