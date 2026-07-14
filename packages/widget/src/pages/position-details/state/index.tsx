import { useAtomValue } from "@effect/atom-react";
import BigNumber from "bignumber.js";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { Dispatch, PropsWithChildren } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { config } from "../../../config";
import type { PendingAction } from "../../../domain/schema/action-models";
import type { EarnBalance } from "../../../domain/schema/earn-models";
import type { AppToken } from "../../../domain/schema/legacy-models";
import {
  getPendingActionAmountConfig,
  type YieldPendingActionType,
} from "../../../domain/types/pending-action";

import { getYieldActionArg, isERC4626 } from "../../../domain/types/yields";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../../hooks/api/position-atoms";
import { PricesKey, pricesAtom } from "../../../hooks/api/prices-atoms";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../hooks/api/yield-atoms";
import { useUnstakeOrPendingActionParams } from "../../../hooks/navigation/use-unstake-or-pending-action-params";
import { useMaxMinYieldAmount } from "../../../hooks/use-max-min-yield-amount";
import { useStakedOrLiquidBalance } from "../../../hooks/use-staked-or-liquid-balance";
import type {
  Actions,
  BalanceTokenActionType,
  ExtraData,
  State,
} from "./types";
import { getBalanceTokenActionType } from "./utils";

const UnstakeOrPendingActionContext = createContext<
  (State & ExtraData) | undefined
>(undefined);

const UnstakeOrPendingActionDispatchContext = createContext<
  Dispatch<Actions> | undefined
>(undefined);

export const UnstakeOrPendingActionProvider = ({
  children,
}: PropsWithChildren) => {
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

  const reducer = (state: State, action: Actions): State => {
    switch (action.type) {
      case "unstake/amount/change": {
        return {
          ...state,
          unstakeAmount: action.data,
          unstakeUseMaxAmount: false,
        };
      }

      case "unstake/amount/max": {
        return {
          ...state,
          unstakeAmount: maxEnterOrExitAmount,
          unstakeUseMaxAmount: true,
        };
      }

      case "pendingAction/amount/change": {
        return {
          ...state,
          pendingActions: getCorrectPendingActionAmount({
            state: state.pendingActions,
            ...action.data,
          }),
        };
      }

      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, {
    unstakeAmount: minEnterOrExitAmount,
    unstakeUseMaxAmount: false,
    pendingActions: new Map(),
  });

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

  return (
    <UnstakeOrPendingActionContext.Provider value={value}>
      <UnstakeOrPendingActionDispatchContext.Provider value={dispatch}>
        {children}
      </UnstakeOrPendingActionDispatchContext.Provider>
    </UnstakeOrPendingActionContext.Provider>
  );
};

export const useUnstakeOrPendingActionState = () => {
  const state = useContext(UnstakeOrPendingActionContext);
  if (state === undefined) {
    throw new Error(
      "useUnstakeOrPendingActionState must be used within a UnstakeContextProvider"
    );
  }

  return state;
};

export const useUnstakeOrPendingActionDispatch = () => {
  const dispatch = useContext(UnstakeOrPendingActionDispatchContext);
  if (dispatch === undefined) {
    throw new Error(
      "useUnstakeOrPendingActionDispatch must be used within a UnstakeContextProvider"
    );
  }

  return dispatch;
};
