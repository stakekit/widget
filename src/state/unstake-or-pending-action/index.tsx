import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import {
  Dispatch,
  PropsWithChildren,
  createContext,
  useContext,
  useMemo,
  useReducer,
} from "react";
import { useStakeExitAndTxsConstruct } from "../../hooks/api/use-stake-exit-and-txs-construct";
import { PendingActionDto, PriceRequestDto } from "@stakekit/api-hooks";
import { usePendingActionAndTxsConstruct } from "../../hooks/api/use-pending-action-and-txs-construct";
import { useOnPendingAction } from "../../pages/position-details/hooks/use-on-pending-action";
import { useParams } from "react-router-dom";
import { useYieldOpportunity } from "../../hooks/api/use-yield-opportunity";
import { usePositionBalances } from "../../hooks/use-position-balances";
import { usePositionBalanceByType } from "../../hooks/use-position-balance-by-type";
import { useStakedOrLiquidBalance } from "../../hooks/use-staked-or-liquid-balance";
import { Actions, ExtraData, State } from "./types";
import { usePrices } from "../../hooks/api/use-prices";
import { config } from "../../config";
import { tokenToTokenDto } from "../../utils/mappers";
import { getBaseToken } from "../../domain";
import { useMaxMinYieldAmount } from "../../hooks/use-max-min-yield-amount";
import { useForceMaxAmount } from "../../hooks/use-force-max-amount";
import { useTransactionTotalGas } from "../../hooks/use-transaction-total-gas";

const getInitialState = (): State => ({
  unstakeAmount: new BigNumber(0),
  pendingActions: new Map(),
});

const UnstakeOrPendingActionContext = createContext<
  (State & ExtraData) | undefined
>(undefined);

const UnstakeOrPendingActionDispatchContext = createContext<
  Dispatch<Actions> | undefined
>(undefined);

export const UnstakeOrPendingActionContextProvider = ({
  children,
}: PropsWithChildren) => {
  const params = useParams<{
    integrationId: string;
    balanceId: string;
    pendingActionType?: PendingActionDto["type"];
  }>();

  const { balanceId, integrationId, pendingActionType } = useMemo(
    () => ({
      integrationId: Maybe.fromNullable(params.integrationId),
      balanceId: Maybe.fromNullable(params.balanceId),
      pendingActionType: Maybe.fromNullable(params.pendingActionType),
    }),
    [params.balanceId, params.integrationId, params.pendingActionType]
  );

  const yieldOpportunity = useYieldOpportunity(integrationId.extract());

  const integrationData = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const positionBalances = usePositionBalances({
    balanceId: balanceId.extract(),
    integrationId: integrationId.extract(),
  });

  const positionBalancePrices = usePrices(
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
  const positionBalancesByType = usePositionBalanceByType({
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

  const { maxEnterOrExitAmount, minEnterOrExitAmount } = useMaxMinYieldAmount({
    yieldOpportunity: integrationData,
    type: "exit",
    positionBalancesByType,
  });

  const forceMaxUnstakeAmount = useForceMaxAmount({
    type: "exit",
    integration: integrationData,
  });

  const canChangeUnstakeAmount = integrationData.map(
    (d) => !!(!forceMaxUnstakeAmount && d.args.exit?.args?.amount?.required)
  );

  const getCorrectUnstakeAmount = (amount: BigNumber) =>
    Maybe.fromRecord({
      reducedStakedOrLiquidBalance,
      canChangeUnstakeAmount,
      integrationData,
    })
      .map((val) => {
        if (
          (!val.canChangeUnstakeAmount || forceMaxUnstakeAmount) &&
          !val.reducedStakedOrLiquidBalance.amount.isEqualTo(amount)
        ) {
          return val.reducedStakedOrLiquidBalance.amount;
        } else if (val.canChangeUnstakeAmount) {
          if (amount.isGreaterThan(maxEnterOrExitAmount)) {
            return maxEnterOrExitAmount;
          } else if (amount.isLessThan(minEnterOrExitAmount)) {
            return minEnterOrExitAmount;
          }
        }

        return amount;
      })
      .orDefault(amount);

  const positionBalancesByTypePendingActions = useMemo(
    () =>
      new Map<PendingActionDto["type"], PendingActionDto>(
        positionBalancesByType
          .map((pbbt) =>
            [...pbbt.values()].flatMap((val) =>
              val.flatMap((b) =>
                b.pendingActions.map((p) => [p.type, p] as const)
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
    type,
  }: {
    state: State["pendingActions"];
    type: PendingActionDto["type"];
    amount: BigNumber;
  }) =>
    Maybe.fromNullable(
      positionBalancesByTypePendingActions.get(type)
    ).mapOrDefault((pendingAction) => {
      const newMap = new Map(state);
      newMap.set(type, amount);

      const max = new BigNumber(
        pendingAction.args?.args?.amount?.maximum ?? Infinity
      );
      const min = new BigNumber(pendingAction.args?.args?.amount?.minimum ?? 0);

      if (amount.isLessThan(min)) {
        newMap.set(type, min);
      } else if (amount.isGreaterThan(max)) {
        newMap.set(type, max);
      }

      return newMap;
    }, state);

  const reducer = (state: State, action: Actions): State => {
    switch (action.type) {
      case "unstake/amount/change": {
        return {
          ...state,
          unstakeAmount: getCorrectUnstakeAmount(action.data),
        };
      }

      case "unstake/amount/max": {
        return {
          ...state,
          unstakeAmount: getCorrectUnstakeAmount(maxEnterOrExitAmount),
        };
      }

      case "pendingAction/amount/change": {
        const newMap = new Map(state.pendingActions);
        newMap.set(action.data.actionType, action.data.amount);

        return {
          ...state,
          pendingActions: getCorrectPendingActionAmount({
            state: state.pendingActions,
            amount: action.data.amount,
            type: action.data.actionType,
          }),
        };
      }

      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, getInitialState());

  const { pendingActions, unstakeAmount } = state;

  const stakeExitAndTxsConstructMutationState = useStakeExitAndTxsConstruct();
  const pendingActionAndTxsConstructMutationState =
    usePendingActionAndTxsConstruct();

  const unstakeSession = useMemo(
    () =>
      Maybe.fromNullable(
        stakeExitAndTxsConstructMutationState?.data?.stakeExitRes
      ),
    [stakeExitAndTxsConstructMutationState?.data?.stakeExitRes]
  );

  const pendingActionSession = useMemo(
    () =>
      Maybe.fromNullable(
        pendingActionAndTxsConstructMutationState?.data?.pendingActionRes
      ),
    [pendingActionAndTxsConstructMutationState?.data?.pendingActionRes]
  );

  const stakeExitTxGas = useTransactionTotalGas(
    stakeExitAndTxsConstructMutationState?.data?.transactionConstructRes
  );

  const pendingActionTxGas = useTransactionTotalGas(
    pendingActionAndTxsConstructMutationState?.data?.transactionConstructRes
  );

  const onPendingActionState = useOnPendingAction();

  const pendingActionToken = useMemo<ExtraData["pendingActionToken"]>(
    () =>
      Maybe.fromNullable(onPendingActionState?.data).map(
        (val) => val.yieldBalance.token
      ),
    [onPendingActionState?.data]
  );

  const value: State & ExtraData = useMemo(
    () => ({
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
      stakeExitTxGas,
      unstakeSession,
      pendingActionSession,
      pendingActionTxGas,
      pendingActionToken,
    }),
    [
      integrationData,
      pendingActions,
      pendingActionSession,
      pendingActionToken,
      pendingActionTxGas,
      pendingActionType,
      positionBalancePrices,
      positionBalances,
      positionBalancesByType,
      reducedStakedOrLiquidBalance,
      stakeExitTxGas,
      stakedOrLiquidBalances,
      unstakeAmount,
      unstakeSession,
      yieldOpportunity,
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
    throw new Error("useState must be used within a UnstakeContextProvider");
  }

  return state;
};

export const useUnstakeOrPendingActionDispatch = () => {
  const dispatch = useContext(UnstakeOrPendingActionDispatchContext);
  if (dispatch === undefined) {
    throw new Error("useDispatch must be used within a UnstakeContextProvider");
  }

  return dispatch;
};
