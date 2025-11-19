import type {
  ActionTypes,
  PendingActionDto,
  PriceRequestDto,
  TokenDto,
  YieldBalanceDto,
} from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
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
import { isForceMaxAmount } from "../../../domain/types/stake";
import { isERC4626 } from "../../../domain/types/yields";
import { usePrices } from "../../../hooks/api/use-prices";
import { useYieldOpportunity } from "../../../hooks/api/use-yield-opportunity";
import { useUnstakeOrPendingActionParams } from "../../../hooks/navigation/use-unstake-or-pending-action-params";
import { useBaseToken } from "../../../hooks/use-base-token";
import { useMaxMinYieldAmount } from "../../../hooks/use-max-min-yield-amount";
import { usePositionBalanceByType } from "../../../hooks/use-position-balance-by-type";
import { usePositionBalances } from "../../../hooks/use-position-balances";
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

  const yieldOpportunity = useYieldOpportunity(integrationId);

  const integrationData = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const baseToken = useBaseToken(integrationData);

  const positionBalancesRemote = usePositionBalances({
    balanceId,
    integrationId,
  });

  const lastExistingPositionBalances = useRef(positionBalancesRemote);

  useEffect(() => {
    if (positionBalancesRemote.data.isNothing()) {
      return;
    }

    lastExistingPositionBalances.current = positionBalancesRemote;
  }, [positionBalancesRemote]);

  /**
   * Prevent position balance being removed after unstake
   */
  const positionBalances = positionBalancesRemote.data.isJust()
    ? positionBalancesRemote
    : lastExistingPositionBalances.current;

  const positionBalancePrices = usePrices(
    useMemo(
      () =>
        Maybe.fromRecord({
          positionBalances: positionBalances.data,
          baseToken,
        })
          .map<PriceRequestDto>((val) => ({
            currency: config.currency,
            tokenList: [
              val.baseToken,
              ...val.positionBalances.balances.map((v) => v.token),
            ],
          }))
          .extractNullable(),
      [positionBalances, baseToken]
    )
  );

  /**
   * @summary Position balance by type
   */
  const positionBalancesByType = usePositionBalanceByType({
    baseToken,
    positionBalancesData: positionBalances.data,
    prices: positionBalancePrices,
  });

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

  const unstakeToken = useMemo(
    () =>
      stakedOrLiquidBalances
        .chain((balances) => List.head(balances))
        .map<TokenDto & { pricePerShare: string }>((v) => ({
          ...v.token,
          pricePerShare: v.pricePerShare,
        })),
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
    availableAmount: reducedStakedOrLiquidBalance.map((v) => v.amount),
    pricePerShare: unstakeToken.map((v) => v.pricePerShare).extractNullable(),
  });

  const canChangeUnstakeAmount = integrationData.map(
    (d) =>
      !!(!isForceMax && (d.args.exit?.args?.amount?.required || isERC4626(d)))
  );

  const positionBalancesByTypePendingActions = useMemo(
    () =>
      new Map<
        BalanceTokenActionType,
        { pendingAction: PendingActionDto; balance: YieldBalanceDto }
      >(
        positionBalancesByType
          .map((pbbt) =>
            [...pbbt.values()].flatMap((val) =>
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
          )
          .orDefault([])
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
    balanceType: YieldBalanceDto["type"];
    token: TokenDto;
    actionType: ActionTypes;
    amount: BigNumber;
  }) => {
    const key = getBalanceTokenActionType({ actionType, balanceType, token });

    return Maybe.fromNullable(
      positionBalancesByTypePendingActions.get(key)
    ).mapOrDefault((val) => {
      const newMap = new Map(state);
      newMap.set(key, amount);

      const max = new BigNumber(
        val.pendingAction.args?.args?.amount?.maximum ??
          Number.POSITIVE_INFINITY
      );
      const min = new BigNumber(
        val.pendingAction.args?.args?.amount?.minimum ?? 0
      );

      if (
        Maybe.fromNullable(val.pendingAction.args?.args?.amount).mapOrDefault(
          isForceMaxAmount,
          false
        )
      ) {
        newMap.set(key, new BigNumber(val.balance.amount));
      } else if (amount.isLessThan(min)) {
        newMap.set(key, min);
      } else if (amount.isGreaterThan(max)) {
        newMap.set(key, max);
      }

      return newMap;
    }, state);
  };

  const reducer = (state: State, action: Actions): State => {
    switch (action.type) {
      case "unstake/amount/change": {
        return {
          ...state,
          unstakeAmount: action.data,
        };
      }

      case "unstake/amount/max": {
        return {
          ...state,
          unstakeAmount: maxEnterOrExitAmount,
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
    pendingActions: new Map(),
  });

  const { pendingActions, unstakeAmount: _ustankeAmount } = state;

  const unstakeAmount = useMemo(
    () =>
      Maybe.fromRecord({
        reducedStakedOrLiquidBalance,
        canChangeUnstakeAmount,
      })
        .map((val) => {
          if (
            (!val.canChangeUnstakeAmount || isForceMax) &&
            !val.reducedStakedOrLiquidBalance.amount.isEqualTo(_ustankeAmount)
          ) {
            return val.reducedStakedOrLiquidBalance.amount;
          }

          return _ustankeAmount;
        })
        .orDefault(_ustankeAmount),
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
      maxIntegrationAmount
        .map((v) => unstakeAmount.isGreaterThan(v))
        .orDefault(false) || unstakeIsLessThanMin,
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
      pendingActions,
      positionBalancePrices,
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
      pendingActions,
      positionBalancePrices,
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

export const useIsUnstakeOrPendingAction = () =>
  !!useContext(UnstakeOrPendingActionContext);
