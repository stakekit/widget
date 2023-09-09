import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import {
  createContext,
  Dispatch,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { Actions, ExtraData, State } from "./types";
import { useStakeEnterAndTxsConstruct } from "../../hooks/api/use-stake-enter-and-txs-construct";
import { useSKWallet } from "../../hooks/wallet/use-sk-wallet";
import { useMaxMinYieldAmount } from "../../hooks/use-max-min-yield-amount";
import { useYields } from "../../hooks/api/opportunities";

const StakeStateContext = createContext<(State & ExtraData) | undefined>(
  undefined
);
const StakeDispatchContext = createContext<Dispatch<Actions> | undefined>(
  undefined
);

const getInitialState = (): State => ({
  selectedStake: Maybe.empty(),
  selectedValidator: Maybe.empty(),
  stakeAmount: Maybe.of(new BigNumber(0)),
});

export const StakeStateProvider = ({ children }: { children: ReactNode }) => {
  const reducer = (state: State, action: Actions): State => {
    switch (action.type) {
      case "stake/select":
        return {
          ...state,
          selectedValidator: Maybe.empty(),
          selectedStake: Maybe.of(action.data),
          stakeAmount: Maybe.fromNullable(
            action.data.args.enter.args?.amount?.minimum
          )
            .toEither(new BigNumber(0))
            .map((min) => new BigNumber(min))
            .toMaybe(),
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

  const { selectedValidator, selectedStake, stakeAmount } = state;

  const { address, network } = useSKWallet();

  /**
   * Reset selectedStake if networks don't match.
   * Can happen on initial load with default selected stake
   */
  selectedStake.ifJust((ss) => {
    network &&
      ss.token.network !== network &&
      dispatch({ type: "state/reset" });
  });

  const ops = useYields();

  /**
   * Set initial stake opportunity
   */
  useEffect(() => {
    Maybe.fromNullable(ops.data?.pages)
      .chain((val) => List.head(val))
      .chain((val) => List.find((v) => v.status.enter, val.data))
      .ifJust((val) =>
        dispatch({
          type: "stake/select",
          data: val,
        })
      );
  }, [address, ops.data?.pages]);

  /**
   * Set initial validator
   */
  useEffect(() => {
    selectedStake.ifJust((ss) => {
      selectedValidator.ifNothing(() => {
        List.head(ss.validators).ifJust((val) =>
          dispatch({ type: "validator/select", data: val })
        );
      });
    });
  }, [selectedStake, selectedValidator]);

  const stakeEnterAndTxsConstruct = useStakeEnterAndTxsConstruct();

  const stakeSession = Maybe.fromNullable(
    stakeEnterAndTxsConstruct.data?.stakeEnterRes
  );

  const stakeEnterTxGas = useMemo(() => {
    return Maybe.fromNullable(stakeEnterAndTxsConstruct.data).map((val) =>
      val.transactionConstructRes.reduce(
        (acc, val) => acc.plus(new BigNumber(val.gasEstimate?.amount ?? 0)),
        new BigNumber(0)
      )
    );
  }, [stakeEnterAndTxsConstruct.data]);

  const { maxEnterOrExitAmount } = useMaxMinYieldAmount({
    type: "enter",
    yieldOpportunity: selectedStake,
  });

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
      selectedValidator,
      selectedStake,
      stakeAmount,
      stakeSession,
      actions,
      stakeEnterTxGas,
    }),
    [
      selectedValidator,
      selectedStake,
      stakeAmount,
      stakeSession,
      actions,
      stakeEnterTxGas,
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
