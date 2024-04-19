import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import type { Dispatch, PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import type { Actions, ExtraData, State } from "./types";
import {
  StakeEnterAndTxsConstructProvider,
  useStakeEnterAndTxsConstruct,
} from "../../hooks/api/use-stake-enter-and-txs-construct";
import { useMaxMinYieldAmount } from "../../hooks/use-max-min-yield-amount";
import {
  getYieldOpportunityFromCache,
  useYieldOpportunity,
} from "../../hooks/api/use-yield-opportunity";
import { useForceMaxAmount } from "../../hooks/use-force-max-amount";
import type { TokenBalanceScanResponseDto } from "@stakekit/api-hooks";
import { useSKWallet } from "../../providers/sk-wallet";
import { useTokenBalancesScan } from "../../hooks/api/use-token-balances-scan";
import { useDefaultTokens } from "../../hooks/api/use-default-tokens";
import { equalTokens } from "../../domain";
import { useSavedRef } from "../../hooks";
import { useInitQueryParams } from "../../hooks/use-init-query-params";
import { PendingActionAndTxsConstructContextProvider } from "../../hooks/api/use-pending-action-and-txs-construct";
import { StakeExitAndTxsConstructContextProvider } from "../../hooks/api/use-stake-exit-and-txs-construct";
import { OnPendingActionProvider } from "../../pages/position-details/hooks/use-on-pending-action";
import { useIsomorphicEffect } from "../../hooks/use-isomorphic-effect";
import { useSKQueryClient } from "../../providers/query-client";
import { useMultiYields } from "../../hooks/api/use-multi-yields";

const StakeStateContext = createContext<(State & ExtraData) | undefined>(
  undefined
);
const StakeDispatchContext = createContext<Dispatch<Actions> | undefined>(
  undefined
);

const getInitialState = (): State => ({
  selectedTokenBalance: Maybe.empty(),
  selectedStakeId: Maybe.empty(),
  selectedValidators: new Map(),
  stakeAmount: new BigNumber(0),
  tronResource: Maybe.empty(),
});

const Provider = ({ children }: PropsWithChildren) => {
  const initParams = useInitQueryParams();

  const reducer = (state: State, action: Actions): State => {
    switch (action.type) {
      case "tokenBalance/select": {
        const tokenNotChanged = state.selectedTokenBalance
          .map((tb) => equalTokens(tb.token, action.data.tokenBalance.token))
          .orDefault(false);

        const selectedStakeId = tokenNotChanged
          ? state.selectedStakeId
          : Maybe.fromNullable(initParams.data)
              .chain((params) =>
                Maybe.fromPredicate(
                  (val) => !!(val.network && val.token && val.yieldId),
                  params
                )
              )
              .chain((val) =>
                List.find(
                  (availableYield) =>
                    action.data.tokenBalance.token.network === val.network &&
                    val.yieldId === availableYield,
                  action.data.tokenBalance.availableYields
                )
              )
              .altLazy(() =>
                List.head(action.data.tokenBalance.availableYields)
              );

        const stakeAmount = tokenNotChanged
          ? state.stakeAmount
          : action.data.initYield
              .chainNullable((val) => val.args.enter.args?.amount?.minimum)
              .chain((val) => Maybe.fromPredicate((v) => v >= 0, val))
              .map((val) => new BigNumber(val))
              .orDefault(new BigNumber(0));

        const selectedValidators = tokenNotChanged
          ? state.selectedValidators
          : action.data.initYield
              .chain((val) => List.head(val.validators))
              .map((v) => new Map([[v.address, v]]))
              .orDefault(new Map());

        return {
          selectedTokenBalance: Maybe.of(action.data.tokenBalance),
          selectedStakeId,
          stakeAmount,
          selectedValidators,
          tronResource: Maybe.empty(),
        };
      }
      case "yield/select":
        return {
          ...state,
          selectedStakeId: Maybe.of(action.data.id),
          selectedValidators: List.head(action.data.validators)
            .map((v) => new Map([[v.address, v]]))
            .orDefault(new Map()),
        };
      case "validator/select": {
        const selectedValidators = new Map();
        selectedValidators.set(action.data.address, action.data);

        return {
          ...state,
          selectedValidators,
        };
      }
      case "validator/multiselect": {
        const newMap = new Map(state.selectedValidators);

        if (newMap.has(action.data.address)) {
          newMap.delete(action.data.address);
        } else {
          newMap.set(action.data.address, action.data);
        }

        if (newMap.size === 0) return state;

        return {
          ...state,
          selectedValidators: newMap,
        };
      }
      case "validator/remove": {
        const selectedValidators = new Map(state.selectedValidators);
        selectedValidators.delete(action.data.address);

        return {
          ...state,
          selectedValidators,
        };
      }
      case "stakeAmount/change": {
        return {
          ...state,
          stakeAmount: action.data,
        };
      }
      case "stakeAmount/max": {
        return {
          ...state,
          stakeAmount: action.data,
        };
      }
      case "tronResource/select": {
        return { ...state, tronResource: Maybe.of(action.data) };
      }
      case "state/reset": {
        return getInitialState();
      }
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, getInitialState());

  const {
    selectedTokenBalance: _selectedTokenBalance,
    selectedStakeId,
    selectedValidators,
    stakeAmount: selectedStakeAmount,
    tronResource,
  } = state;

  const yieldOpportunity = useYieldOpportunity(selectedStakeId.extract());

  const selectedStake = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const { minEnterOrExitAmount, maxEnterOrExitAmount } = useMaxMinYieldAmount({
    type: "enter",
    yieldOpportunity: Maybe.fromNullable(yieldOpportunity.data),
    tokenDto: _selectedTokenBalance.map((v) => v.token),
  });

  const forceMax = useForceMaxAmount({
    integration: selectedStake,
    type: "enter",
  });

  /**
   * If stake amount is less then min, use min
   */
  const stakeAmount = useMemo(() => {
    if (forceMax) {
      return maxEnterOrExitAmount;
    } else if (selectedStakeAmount.isLessThan(minEnterOrExitAmount)) {
      return minEnterOrExitAmount;
    } else if (selectedStakeAmount.isGreaterThan(maxEnterOrExitAmount)) {
      return maxEnterOrExitAmount;
    }
    return selectedStakeAmount;
  }, [
    forceMax,
    maxEnterOrExitAmount,
    minEnterOrExitAmount,
    selectedStakeAmount,
  ]);

  const { network, isLedgerLive, isConnected, isConnecting } = useSKWallet();

  const tokenBalancesScan = useTokenBalancesScan();
  const defaultTokens = useDefaultTokens();

  const tokenBalances =
    (isConnected || isConnecting) &&
    (tokenBalancesScan.isLoading || !!tokenBalancesScan.data?.length)
      ? tokenBalancesScan
      : defaultTokens;

  const currentSelectedTokenBalanceRef = useSavedRef(_selectedTokenBalance);

  const initialTokenBalanceToSet = useMemo(
    () =>
      Maybe.fromNullable(tokenBalances.data).chain((tb) =>
        Maybe.fromNullable(initParams.data)
          .chain((params) =>
            Maybe.fromPredicate((val) => !!(val.network && val.token), params)
          )
          .chain((val) =>
            List.find(
              (t) =>
                t.token.symbol === val.token && t.token.network === val.network,
              tb
            ).altLazy(() =>
              Maybe.fromNullable(defaultTokens.data).chain((dt) =>
                List.find((t) => t.token.symbol === val.token, dt)
              )
            )
          )
          .altLazy(() =>
            currentSelectedTokenBalanceRef.current.chain((val) =>
              List.find((v) => equalTokens(val.token, v.token), tb)
            )
          )
          .altLazy(() =>
            List.find(
              (v) =>
                !!v.availableYields.length &&
                new BigNumber(v.amount).isGreaterThan(0),
              tb
            )
          )
          .altLazy(() => List.find((v) => !!v.availableYields.length, tb))
      ),
    [
      currentSelectedTokenBalanceRef,
      defaultTokens.data,
      initParams.data,
      tokenBalances.data,
    ]
  );

  /**
   * Reset selectedTokenBalance if we changed network
   */
  _selectedTokenBalance.ifJust((ss) => {
    if (network && ss.token.network !== network) {
      dispatch({ type: "state/reset" });
    }
  });

  const queryClient = useSKQueryClient();

  const setInitialTokenBalance = useCallback(
    (tokenBalance: TokenBalanceScanResponseDto) => {
      dispatch({
        type: "tokenBalance/select",
        data: {
          tokenBalance,
          initYield: Maybe.fromNullable(initParams.data)
            .chain((params) =>
              Maybe.fromPredicate(
                (val) => !!(val.network && val.yieldId),
                params
              )
            )
            .chain((val) =>
              List.find(
                (y) =>
                  tokenBalance.token.network === val.network &&
                  val.yieldId === y,
                tokenBalance.availableYields
              )
            )
            .altLazy(() => List.head(tokenBalance.availableYields))
            .chain((yId) =>
              getYieldOpportunityFromCache({
                yieldId: yId,
                isLedgerLive,
                queryClient,
              })
            ),
        },
      });
    },
    [initParams.data, isLedgerLive, queryClient]
  );

  /**
   * Set initial token balance
   */
  useIsomorphicEffect(() => {
    if (initParams.isLoading) return;

    initialTokenBalanceToSet.ifJust(setInitialTokenBalance);
  }, [initParams.isLoading, initialTokenBalanceToSet, setInitialTokenBalance]);

  useIsomorphicEffect(() => {
    if (initParams.isLoading) return;

    _selectedTokenBalance.ifNothing(() =>
      initialTokenBalanceToSet.ifJust(setInitialTokenBalance)
    );
  }, [
    initialTokenBalanceToSet,
    _selectedTokenBalance,
    setInitialTokenBalance,
    initParams.isLoading,
  ]);

  /**
   * Reset selectedTokenBalance if we dont have initialTokenBalanceToSet
   * Case when we changed account, but we dont have available yields
   */
  useIsomorphicEffect(() => {
    if (initParams.isLoading) return;

    initialTokenBalanceToSet.ifNothing(() =>
      _selectedTokenBalance.ifJust(() => dispatch({ type: "state/reset" }))
    );
  }, [initialTokenBalanceToSet, _selectedTokenBalance, initParams.isLoading]);

  /**
   * Set initial validator
   */
  useIsomorphicEffect(() => {
    Maybe.fromNullable(yieldOpportunity.data).ifJust((yo) => {
      if (!!selectedValidators.size) return;

      Maybe.fromNullable(initParams.data)
        .chainNullable((params) => params.validator)
        .chain((initV) =>
          List.find(
            (val) => val.name === initV || val.address === initV,
            yo.validators
          )
        )
        .altLazy(() => List.head(yo.validators))
        .ifJust((val) => dispatch({ type: "validator/select", data: val }));
    });
  }, [initParams.data, selectedValidators, yieldOpportunity.data]);

  const stakeEnterAndTxsConstructMutationState = useStakeEnterAndTxsConstruct();

  const stakeSession = useMemo(
    () =>
      Maybe.fromNullable(
        stakeEnterAndTxsConstructMutationState.data?.actionDto
      ),
    [stakeEnterAndTxsConstructMutationState.data?.actionDto]
  );

  const isGasCheckError = useMemo(
    () =>
      Maybe.fromNullable(stakeEnterAndTxsConstructMutationState.data)
        .chainNullable((val) => val.gasCheckErr)
        .isJust(),
    [stakeEnterAndTxsConstructMutationState.data]
  );

  const stakeEnterTxGas = useMemo(
    () =>
      Maybe.fromNullable(
        stakeEnterAndTxsConstructMutationState.data?.actionDto.gasEstimate
          .amount
      ),
    [stakeEnterAndTxsConstructMutationState.data?.actionDto.gasEstimate.amount]
  );

  const actions = useMemo(
    () => ({
      onMaxClick: () => {
        dispatch({
          type: "stakeAmount/max",
          data: maxEnterOrExitAmount,
        });
      },
    }),
    [maxEnterOrExitAmount]
  );

  const selectedTokenBalance = _selectedTokenBalance.alt(
    initialTokenBalanceToSet
  );

  const enterEnabledMultiYields = useMultiYields(
    selectedTokenBalance.mapOrDefault((val) => val.availableYields, []),
    { select: (val) => val.filter((v) => v.status.enter) }
  );

  /**
   * If selected stake has "enter" disabled, find next one with "enter" enabled
   */
  useIsomorphicEffect(() => {
    Maybe.fromNullable(yieldOpportunity.data)
      .filter((val) => !val.status.enter)
      .chainNullable(() => enterEnabledMultiYields.data)
      .chain((val) => List.head(val))
      .ifJust((val) => dispatch({ type: "yield/select", data: val }));
  }, [enterEnabledMultiYields.data, yieldOpportunity.data]);

  const value: State & ExtraData = useMemo(
    () => ({
      selectedStakeId,
      selectedStake,
      selectedTokenBalance,
      selectedValidators,
      stakeAmount,
      stakeSession,
      actions,
      stakeEnterTxGas,
      tronResource,
      isGasCheckError,
    }),
    [
      actions,
      selectedStake,
      selectedStakeId,
      selectedTokenBalance,
      selectedValidators,
      stakeAmount,
      stakeEnterTxGas,
      stakeSession,
      tronResource,
      isGasCheckError,
    ]
  );

  return (
    <StakeStateContext.Provider value={value}>
      <StakeDispatchContext.Provider value={dispatch}>
        {children}
      </StakeDispatchContext.Provider>
    </StakeStateContext.Provider>
  );
};

export const StakeStateProvider = ({ children }: PropsWithChildren) => {
  return (
    <StakeEnterAndTxsConstructProvider>
      <PendingActionAndTxsConstructContextProvider>
        <StakeExitAndTxsConstructContextProvider>
          <OnPendingActionProvider>
            <Provider>{children}</Provider>
          </OnPendingActionProvider>
        </StakeExitAndTxsConstructContextProvider>
      </PendingActionAndTxsConstructContextProvider>
    </StakeEnterAndTxsConstructProvider>
  );
};

export const useStakeState = () => {
  const state = useContext(StakeStateContext);
  if (state === undefined) {
    throw new Error("useState must be used within a StateProvider");
  }

  return state;
};

export const useStakeDispatch = () => {
  const dispatch = useContext(StakeDispatchContext);
  if (dispatch === undefined) {
    throw new Error("useDispatch must be used within a StateProvider");
  }

  return dispatch;
};
