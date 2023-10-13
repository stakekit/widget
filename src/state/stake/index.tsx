import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import {
  createContext,
  Dispatch,
  ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
} from "react";
import { Actions, ExtraData, State } from "./types";
import { useStakeEnterAndTxsConstruct } from "../../hooks/api/use-stake-enter-and-txs-construct";
import { useMaxMinYieldAmount } from "../../hooks/use-max-min-yield-amount";
import {
  getYieldOpportunityFromCache,
  useYieldOpportunity,
} from "../../hooks/api/use-yield-opportunity";
import { useTokensBalances } from "../../hooks/api/use-tokens-balances";
import { useSKWallet } from "../../hooks/wallet/use-sk-wallet";
import { useForceMaxAmount } from "../../hooks/use-force-max-amount";

const StakeStateContext = createContext<(State & ExtraData) | undefined>(
  undefined
);
const StakeDispatchContext = createContext<Dispatch<Actions> | undefined>(
  undefined
);

const getInitialState = (): State => ({
  selectedTokenBalance: Maybe.empty(),
  selectedStakeId: Maybe.empty(),
  selectedValidator: Maybe.empty(),
  stakeAmount: Maybe.of(new BigNumber(0)),
});

export const StakeStateProvider = ({ children }: { children: ReactNode }) => {
  const reducer = (state: State, action: Actions): State => {
    switch (action.type) {
      case "tokenBalance/select": {
        const selectedStakeId = List.head(
          action.data.tokenBalance.availableYields
        );

        return {
          selectedTokenBalance: Maybe.of(action.data.tokenBalance),
          selectedStakeId,
          stakeAmount: action.data.initYield
            .chainNullable((val) => val.args.enter.args?.amount?.minimum)
            .chain((val) => Maybe.fromPredicate((v) => v >= 0, val))
            .map((val) => new BigNumber(val))
            .alt(Maybe.of(new BigNumber(0))),
          selectedValidator: action.data.initYield.chain((val) =>
            List.head(val.validators)
          ),
        };
      }
      case "yield/select":
        return {
          ...state,
          selectedStakeId: Maybe.of(action.data.id),
          selectedValidator: List.head(action.data.validators),
          stakeAmount: Maybe.of(new BigNumber(0)),
        };
      case "validator/select": {
        return {
          ...state,
          selectedValidator: Maybe.of(action.data),
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
      case "state/reset": {
        return getInitialState();
      }
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, getInitialState());

  const {
    selectedTokenBalance,
    selectedStakeId,
    selectedValidator,
    stakeAmount: selectedStakeAmount,
  } = state;

  const yieldOpportunity = useYieldOpportunity(selectedStakeId.extract());

  const selectedStake = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const { minEnterOrExitAmount, maxEnterOrExitAmount } = useMaxMinYieldAmount({
    type: "enter",
    yieldOpportunity: Maybe.fromNullable(yieldOpportunity.data),
  });

  const forceMax = useForceMaxAmount({
    integration: selectedStake,
    type: "enter",
  });

  /**
   * If stake amount is less then min, use min
   */
  const stakeAmount = useMemo(
    () =>
      selectedStakeAmount.map((val) => {
        if (forceMax) {
          return maxEnterOrExitAmount;
        } else if (val.isLessThan(minEnterOrExitAmount)) {
          return minEnterOrExitAmount;
        } else if (val.isGreaterThan(maxEnterOrExitAmount)) {
          return maxEnterOrExitAmount;
        }
        return val;
      }),
    [forceMax, maxEnterOrExitAmount, minEnterOrExitAmount, selectedStakeAmount]
  );

  const tokenBalances = useTokensBalances();

  const initialYieldToSet = useMemo(
    () =>
      Maybe.fromNullable(tokenBalances.data).chain((val) =>
        List.find((v) => !!v.availableYields.length, val)
      ),
    [tokenBalances.data]
  );

  const { network, isLedgerLive } = useSKWallet();

  /**
   * Reset selectedTokenBalance if we changed network
   */
  selectedTokenBalance.ifJust((ss) => {
    if (network && ss.token.network !== network) {
      dispatch({ type: "state/reset" });
    }
  });

  /**
   * Set initial token balance
   */
  useLayoutEffect(() => {
    initialYieldToSet.ifJust((val) => {
      dispatch({
        type: "tokenBalance/select",
        data: {
          tokenBalance: val,
          initYield: List.head(val.availableYields).chainNullable((yId) =>
            getYieldOpportunityFromCache({
              integrationId: yId,
              isLedgerLive,
            })
          ),
        },
      });
    });
  }, [initialYieldToSet, isLedgerLive]);

  /**
   * Reset selectedTokenBalance if we dont have initialYieldToSet
   * Case when we changed account, but we dont have available yields
   */
  useLayoutEffect(() => {
    initialYieldToSet.ifNothing(() =>
      selectedTokenBalance.ifJust(() => dispatch({ type: "state/reset" }))
    );
  }, [initialYieldToSet, selectedTokenBalance]);

  /**
   * Set initial validator
   */
  useLayoutEffect(() => {
    Maybe.fromNullable(yieldOpportunity.data).ifJust((yo) =>
      selectedValidator.ifNothing(() =>
        List.head(yo.validators).ifJust((val) =>
          dispatch({ type: "validator/select", data: val })
        )
      )
    );
  }, [selectedValidator, yieldOpportunity.data]);

  const stakeEnterAndTxsConstruct = useStakeEnterAndTxsConstruct();

  const stakeSession = Maybe.fromNullable(
    stakeEnterAndTxsConstruct.data?.stakeEnterRes
  );

  const stakeEnterTxGas = useMemo(
    () =>
      Maybe.fromNullable(stakeEnterAndTxsConstruct.data).map((val) =>
        val.transactionConstructRes.reduce(
          (acc, val) => acc.plus(new BigNumber(val.gasEstimate?.amount ?? 0)),
          new BigNumber(0)
        )
      ),
    [stakeEnterAndTxsConstruct.data]
  );

  const actions = useMemo(
    () => ({
      onMaxClick: () => {
        dispatch({
          type: "stakeAmount/max",
          data: Maybe.of(maxEnterOrExitAmount),
        });
      },
    }),
    [maxEnterOrExitAmount]
  );

  const value: State & ExtraData = useMemo(
    () => ({
      selectedStakeId,
      selectedStake,
      selectedTokenBalance,
      selectedValidator,
      stakeAmount,
      stakeSession,
      actions,
      stakeEnterTxGas,
    }),
    [
      actions,
      selectedStake,
      selectedStakeId,
      selectedTokenBalance,
      selectedValidator,
      stakeAmount,
      stakeEnterTxGas,
      stakeSession,
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
