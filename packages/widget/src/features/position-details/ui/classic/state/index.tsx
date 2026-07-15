import { useAtom, useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect, useMemo, useRef } from "react";
import type { PendingAction } from "../../../../../domain/schema/action-models";
import type { EarnBalance } from "../../../../../domain/schema/earn-models";
import type { AppToken } from "../../../../../domain/schema/legacy-models";
import {
  getPendingActionAmountConfig,
  type YieldPendingActionType,
} from "../../../../../domain/types/pending-action";
import {
  getYieldActionArg,
  isERC4626,
} from "../../../../../domain/types/yields";
import { config } from "../../../../../shared/config/widget-defaults";
import { useUnstakeOrPendingActionParams } from "../../../../../shared/react/navigation/use-unstake-or-pending-action-params";
import {
  PricesKey,
  pricesAtom,
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../../earn";
import { useMaxMinYieldAmount } from "../../../../earn/support";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../../../portfolio";
import { useStakedOrLiquidBalance } from "../../../react/use-staked-or-liquid-balance";
import {
  makePositionDetailsWorkflowState,
  type PositionDetailsWorkflowAction,
  positionDetailsWorkflowAtom,
  reducePositionDetailsWorkflow,
} from "../../../state";
import type { BalanceTokenActionType, ExtraData, State } from "./types";
import { getBalanceTokenActionType } from "./utils";

export const useUnstakeOrPendingAction = () => {
  const { plain, pendingActionType } = useUnstakeOrPendingActionParams();

  const balanceId = plain.balanceId;
  const integrationId = plain.integrationId;

  const yieldOpportunity = useAtomValue(
    yieldOpportunityAtom(
      new YieldOpportunityKey({ yieldId: integrationId ?? null })
    )
  );
  const integrationData = yieldOpportunity.pipe(
    AsyncResult.value,
    Option.getOrNull
  );

  const baseToken = integrationData?.token ?? null;

  const positionKey = new PositionBalancesKey({
    balanceId: balanceId ?? null,
    yieldId: integrationId ?? null,
  });
  const positionBalancesResult = useAtomValue(
    positionBalancesAtom(positionKey)
  );
  const positionBalancesRemote = AsyncResult.getOrElse(
    positionBalancesResult,
    () => null
  );

  const lastExistingPositionBalances = useRef(positionBalancesRemote);

  useEffect(() => {
    if (!positionBalancesRemote) {
      return;
    }

    lastExistingPositionBalances.current = positionBalancesRemote;
  }, [positionBalancesRemote]);

  /**
   * Prevent position balance being removed after unstake
   */
  const positionBalances = positionBalancesRemote
    ? positionBalancesRemote
    : lastExistingPositionBalances.current;

  const positionBalancePrices = useAtomValue(
    pricesAtom(
      new PricesKey({
        request:
          positionBalances && baseToken
            ? {
                currency: config.currency,
                tokenList: [
                  baseToken,
                  ...positionBalances.balances.map((balance) => balance.token),
                ],
              }
            : null,
      })
    )
  );

  const positionBalancesByTypeRemote = AsyncResult.getOrElse(
    useAtomValue(positionBalancesByTypeAtom(positionKey)),
    () => null
  );
  const lastExistingPositionBalancesByType = useRef(
    positionBalancesByTypeRemote
  );

  useEffect(() => {
    if (positionBalancesByTypeRemote) {
      lastExistingPositionBalancesByType.current = positionBalancesByTypeRemote;
    }
  }, [positionBalancesByTypeRemote]);

  const positionBalancesByType =
    positionBalancesByTypeRemote ?? lastExistingPositionBalancesByType.current;

  const stakedOrLiquidBalances = useStakedOrLiquidBalance(
    positionBalancesByType
  );

  const reducedStakedOrLiquidBalance = useMemo(() => {
    const first = stakedOrLiquidBalances?.[0];
    return first
      ? stakedOrLiquidBalances.reduce(
          (acc, next) => {
            acc.amount = acc.amount.plus(new BigNumber(next.amount));
            acc.amountUsd = acc.amountUsd.plus(
              new BigNumber(next.amountUsd ?? 0)
            );
            acc.token = next.token;

            return acc;
          },
          {
            amountUsd: new BigNumber(0),
            amount: new BigNumber(0),
            token: first.token,
          }
        )
      : null;
  }, [stakedOrLiquidBalances]);

  const unstakeToken = useMemo(
    () => stakedOrLiquidBalances?.[0]?.token ?? null,
    [stakedOrLiquidBalances]
  );

  const {
    maxIntegrationAmount,
    maxEnterOrExitAmount,
    minEnterOrExitAmount,
    isForceMax,
  } = useMaxMinYieldAmount({
    yieldOpportunity: integrationData,
    type: "exit",
    availableAmount: reducedStakedOrLiquidBalance?.amount ?? null,
    pricePerShare: null,
  });

  const canChangeUnstakeAmount = integrationData
    ? !!(
        !isForceMax &&
        (getYieldActionArg(integrationData, "exit", "amount")?.required ||
          isERC4626(integrationData))
      )
    : null;

  const positionBalancesByTypePendingActions = useMemo(
    () =>
      new Map<
        BalanceTokenActionType,
        { pendingAction: PendingAction; balance: EarnBalance }
      >(
        positionBalancesByType
          ? [...positionBalancesByType.values()].flatMap((val) =>
              val.flatMap((b) =>
                b.pendingActions.map(
                  (p) =>
                    [
                      getBalanceTokenActionType({
                        balanceType: b.type,
                        token: b.token,
                        actionType: p.type,
                      }),
                      { pendingAction: p, balance: b },
                    ] as const
                )
              )
            )
          : []
      ),
    [positionBalancesByType]
  );

  const getCorrectPendingActionAmount = ({
    state,
    amount,
    actionType,
    balanceType,
    token,
  }: {
    state: State["pendingActions"];
    balanceType: EarnBalance["type"];
    token: AppToken;
    actionType: YieldPendingActionType;
    amount: BigNumber;
  }) => {
    const key = getBalanceTokenActionType({ actionType, balanceType, token });

    const value = positionBalancesByTypePendingActions.get(key);
    if (!value) return state;

    const newMap = new Map(state);
    newMap.set(key, amount);

    const amountConfig = getPendingActionAmountConfig(value.pendingAction);
    const max = new BigNumber(
      amountConfig?.maximum ?? Number.POSITIVE_INFINITY
    );
    const min = new BigNumber(amountConfig?.minimum ?? 0);

    if (amountConfig?.forceMax) {
      newMap.set(key, new BigNumber(value.balance.amount));
    } else if (amount.isLessThan(min)) {
      newMap.set(key, min);
    } else if (amount.isGreaterThan(max)) {
      newMap.set(key, max);
    }

    return newMap;
  };

  const [state, setState] = useAtom(positionDetailsWorkflowAtom);
  const workflowKey = `${balanceId ?? ""}:${integrationId ?? ""}:${pendingActionType ?? ""}`;
  const previousWorkflowKey = useRef(workflowKey);

  useEffect(() => {
    if (previousWorkflowKey.current === workflowKey) return;

    previousWorkflowKey.current = workflowKey;
    setState(makePositionDetailsWorkflowState(minEnterOrExitAmount));
  }, [minEnterOrExitAmount, setState, workflowKey]);

  const dispatch = (action: PositionDetailsWorkflowAction) => {
    setState(
      reducePositionDetailsWorkflow({
        action,
        maxUnstakeAmount: maxEnterOrExitAmount,
        pendingActions:
          action.type === "pendingAction/amount/change"
            ? getCorrectPendingActionAmount({
                state: state.pendingActions,
                ...action.data,
              })
            : undefined,
        state,
      })
    );
  };

  const {
    pendingActions,
    unstakeAmount: _ustankeAmount,
    unstakeUseMaxAmount,
  } = state;

  const unstakeAmount = useMemo(
    () =>
      reducedStakedOrLiquidBalance && canChangeUnstakeAmount !== null
        ? (() => {
            if (
              (!canChangeUnstakeAmount || isForceMax) &&
              !reducedStakedOrLiquidBalance.amount.isEqualTo(_ustankeAmount)
            ) {
              return reducedStakedOrLiquidBalance.amount;
            }

            return _ustankeAmount;
          })()
        : _ustankeAmount,
    [
      _ustankeAmount,
      canChangeUnstakeAmount,
      isForceMax,
      reducedStakedOrLiquidBalance,
    ]
  );

  const unstakeAmountValid = useMemo(
    () =>
      unstakeAmount.isGreaterThanOrEqualTo(minEnterOrExitAmount) &&
      unstakeAmount.isLessThanOrEqualTo(maxEnterOrExitAmount) &&
      !unstakeAmount.isZero(),
    [maxEnterOrExitAmount, minEnterOrExitAmount, unstakeAmount]
  );

  const unstakeIsGreaterThanMax = useMemo(
    () => unstakeAmount.isGreaterThan(maxEnterOrExitAmount),
    [unstakeAmount, maxEnterOrExitAmount]
  );

  const unstakeIsLessThanMin = useMemo(
    () => unstakeAmount.isLessThan(minEnterOrExitAmount),
    [unstakeAmount, minEnterOrExitAmount]
  );

  const unstakeIsGreaterOrLessIntegrationLimitError = useMemo(
    () =>
      (maxIntegrationAmount
        ? unstakeAmount.isGreaterThan(maxIntegrationAmount)
        : false) || unstakeIsLessThanMin,
    [unstakeAmount, unstakeIsLessThanMin, maxIntegrationAmount]
  );

  const unstakeAmountError = useMemo(
    () =>
      (!unstakeAmount.isZero() && unstakeIsLessThanMin) ||
      unstakeIsGreaterThanMax ||
      unstakeIsGreaterOrLessIntegrationLimitError,
    [
      unstakeAmount,
      unstakeIsLessThanMin,
      unstakeIsGreaterThanMax,
      unstakeIsGreaterOrLessIntegrationLimitError,
    ]
  );

  const value: State & ExtraData = useMemo(
    () => ({
      canChangeUnstakeAmount,
      unstakeAmountError,
      unstakeToken,
      unstakeAmount,
      unstakeUseMaxAmount,
      pendingActions,
      positionBalancePrices,
      positionBalancesResult,
      reducedStakedOrLiquidBalance,
      positionBalancesByType,
      stakedOrLiquidBalances,
      yieldOpportunity,
      positionBalances,
      pendingActionType,
      integrationData,
      unstakeAmountValid,
      unstakeIsGreaterOrLessIntegrationLimitError,
      minUnstakeAmount: minEnterOrExitAmount,
    }),
    [
      canChangeUnstakeAmount,
      unstakeAmountError,
      unstakeToken,
      unstakeAmount,
      unstakeUseMaxAmount,
      pendingActions,
      positionBalancePrices,
      positionBalancesResult,
      reducedStakedOrLiquidBalance,
      positionBalancesByType,
      stakedOrLiquidBalances,
      yieldOpportunity,
      positionBalances,
      integrationData,
      unstakeAmountValid,
      pendingActionType,
      unstakeIsGreaterOrLessIntegrationLimitError,
      minEnterOrExitAmount,
    ]
  );

  return { dispatch, state: value };
};
