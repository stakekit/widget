import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import type { Dispatch, PropsWithChildren } from "react";
import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useState,
} from "react";
import { useStakeExitAndTxsConstruct } from "../../hooks/api/use-stake-exit-and-txs-construct";
import type {
  ActionTypes,
  PendingActionDto,
  PriceRequestDto,
} from "@stakekit/api-hooks";
import { usePendingActionAndTxsConstruct } from "../../hooks/api/use-pending-action-and-txs-construct";
import { useOnPendingAction } from "../../pages/position-details/hooks/use-on-pending-action";
import { useYieldOpportunity } from "../../hooks/api/use-yield-opportunity";
import { usePositionBalances } from "../../hooks/use-position-balances";
import { usePositionBalanceByType } from "../../hooks/use-position-balance-by-type";
import { useStakedOrLiquidBalance } from "../../hooks/use-staked-or-liquid-balance";
import type { Actions, ExtraData, State } from "./types";
import { usePrices } from "../../hooks/api/use-prices";
import { config } from "../../config";
import { useMaxMinYieldAmount } from "../../hooks/use-max-min-yield-amount";
import { useForceMaxAmount } from "../../hooks/use-force-max-amount";
import { useUnstakeOrPendingActionMatch } from "../../hooks/navigation/use-unstake-or-pending-action-match";
import { usePendingActionSelectValidatorMatch } from "../../hooks/navigation/use-pending-action-select-validator-match";
import { useBaseToken } from "../../hooks/use-base-token";

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

export const UnstakeOrPendingActionProvider = ({
  children,
}: PropsWithChildren<{}>) => {
  const unstakeOrPendingActionFlowMatch = useUnstakeOrPendingActionMatch();
  const pendingActionSelectValidatorMatch =
    usePendingActionSelectValidatorMatch();

  const currentParams = useMemo(() => {
    const { balanceId, integrationId } =
      unstakeOrPendingActionFlowMatch?.params ??
      pendingActionSelectValidatorMatch?.params ??
      {};

    const pendingActionType = pendingActionSelectValidatorMatch?.params
      .pendingActionType as ActionTypes | undefined;

    return {
      balanceId: Maybe.fromNullable(balanceId),
      integrationId: Maybe.fromNullable(integrationId),
      pendingActionType: Maybe.fromNullable(pendingActionType),
      plain: {
        balanceId,
        integrationId,
        pendingActionType,
      },
    };
  }, [
    pendingActionSelectValidatorMatch?.params,
    unstakeOrPendingActionFlowMatch?.params,
  ]);

  /**
   * On navigating away from unstake or pending action flow, keep last params
   * to be able to finish animation with correct params.
   * On next navigation to unstake or pending action flow, use new params
   * and reset state
   */
  const [lastStateParams, setLastStateParams] = useState(currentParams.plain);

  const balanceId = currentParams.plain.balanceId ?? lastStateParams.balanceId;
  const integrationId =
    currentParams.plain.integrationId ?? lastStateParams.integrationId;

  const yieldOpportunity = useYieldOpportunity(integrationId);

  const integrationData = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const baseToken = useBaseToken(integrationData);

  const positionBalances = usePositionBalances({
    balanceId: balanceId,
    integrationId: integrationId,
  });

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
        .map((v) => v.token),
    [stakedOrLiquidBalances]
  );

  const { maxEnterOrExitAmount, minEnterOrExitAmount } = useMaxMinYieldAmount({
    yieldOpportunity: integrationData,
    type: "exit",
    positionBalancesByType,
    tokenDto: unstakeToken,
  });

  const forceMaxUnstakeAmount = useForceMaxAmount({
    type: "exit",
    integration: integrationData,
  });

  const canChangeUnstakeAmount = integrationData.map(
    (d) => !!(!forceMaxUnstakeAmount && d.args.exit?.args?.amount?.required)
  );

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

      case "reset": {
        return { ...getInitialState() };
      }

      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, getInitialState());

  const { pendingActions, unstakeAmount: _ustankeAmount } = state;

  const unstakeAmount = useMemo(
    () =>
      Maybe.fromRecord({
        reducedStakedOrLiquidBalance,
        canChangeUnstakeAmount,
      })
        .map((val) => {
          if (
            (!val.canChangeUnstakeAmount || forceMaxUnstakeAmount) &&
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
      forceMaxUnstakeAmount,
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

  const unstakeAmountError = useMemo(
    () =>
      (!unstakeAmount.isZero() &&
        unstakeAmount.isLessThan(minEnterOrExitAmount)) ||
      unstakeAmount.isGreaterThan(maxEnterOrExitAmount),
    [maxEnterOrExitAmount, minEnterOrExitAmount, unstakeAmount]
  );

  const stakeExitAndTxsConstructMutationState = useStakeExitAndTxsConstruct();
  const pendingActionAndTxsConstructMutationState =
    usePendingActionAndTxsConstruct();

  const unstakeSession = useMemo(
    () =>
      Maybe.fromNullable(stakeExitAndTxsConstructMutationState.data?.actionDto),
    [stakeExitAndTxsConstructMutationState.data?.actionDto]
  );

  const isGasCheckError = useMemo(
    () =>
      Maybe.fromNullable(
        stakeExitAndTxsConstructMutationState.data?.gasCheckErr
      )
        .altLazy(() =>
          Maybe.fromNullable(
            pendingActionAndTxsConstructMutationState.data?.gasCheckErr
          )
        )
        .isJust(),
    [
      pendingActionAndTxsConstructMutationState.data?.gasCheckErr,
      stakeExitAndTxsConstructMutationState.data?.gasCheckErr,
    ]
  );

  const pendingActionSession = useMemo(
    () =>
      Maybe.fromNullable(
        pendingActionAndTxsConstructMutationState.data?.actionDto
      ),
    [pendingActionAndTxsConstructMutationState.data?.actionDto]
  );

  const stakeExitTxGas = useMemo(
    () =>
      Maybe.fromNullable(
        stakeExitAndTxsConstructMutationState.data?.actionDto.gasEstimate.amount
      ),
    [stakeExitAndTxsConstructMutationState.data?.actionDto]
  );

  const pendingActionTxGas = useMemo(
    () =>
      Maybe.fromNullable(
        pendingActionAndTxsConstructMutationState.data?.actionDto.gasEstimate
          .amount
      ),
    [pendingActionAndTxsConstructMutationState.data?.actionDto]
  );

  const onPendingActionState = useOnPendingAction();

  const pendingActionToken = useMemo<ExtraData["pendingActionToken"]>(
    () =>
      Maybe.fromNullable(onPendingActionState?.data).map(
        (val) => val.pendingActionToken
      ),
    [onPendingActionState?.data]
  );

  Maybe.fromRecord({
    integrationId: currentParams.integrationId,
    balanceId: currentParams.balanceId,
  })
    .filter(() => !lastStateParams.balanceId || !lastStateParams.integrationId)
    .ifJust(() => setLastStateParams(currentParams.plain));

  /**
   * Reset state and set new last params on navigation
   */
  Maybe.fromRecord({
    integrationId: currentParams.integrationId,
    balanceId: currentParams.balanceId,
  })
    .filter(
      (val) =>
        !!(lastStateParams.balanceId && lastStateParams.integrationId) &&
        (lastStateParams.balanceId !== val.balanceId ||
          lastStateParams.integrationId !== val.integrationId)
    )
    .ifJust(() => {
      setLastStateParams(currentParams.plain);
      dispatch({ type: "reset" });
      stakeExitAndTxsConstructMutationState.reset();
      pendingActionAndTxsConstructMutationState.reset();
      onPendingActionState.reset();
    });

  const value: State & ExtraData = useMemo(
    () => ({
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
      pendingActionType: currentParams.pendingActionType,
      integrationData,
      stakeExitTxGas,
      unstakeSession,
      pendingActionSession,
      pendingActionTxGas,
      pendingActionToken,
      isGasCheckError,
      unstakeAmountValid,
    }),
    [
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
      currentParams.pendingActionType,
      integrationData,
      stakeExitTxGas,
      unstakeSession,
      pendingActionSession,
      pendingActionTxGas,
      pendingActionToken,
      isGasCheckError,
      unstakeAmountValid,
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
