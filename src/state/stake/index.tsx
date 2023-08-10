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
import { useStakeEnterEnabledOpportunities } from "../../hooks/api/use-filtered-opportunities";
import { useStakeGetValidators } from "@stakekit/api-hooks";
import { useStakeEnterAndTxsConstruct } from "../../hooks/api/use-stake-enter-and-txs-construct";
import { useSKWallet } from "../../hooks/use-sk-wallet";
import { useMaxMinYieldAmount } from "../../hooks/use-max-min-yield-amount";

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
    // console.log("__APP_STATE_ACTION__: ", state, action);

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
    ss.token.network !== network && dispatch({ type: "state/reset" });
  });

  const opportunities = useStakeEnterEnabledOpportunities();

  /**
   * Set initial stake opportunity
   */
  useEffect(() => {
    Maybe.fromNullable(opportunities.data)
      .chain((val) => List.find((o) => o.status.enter, val))
      .ifJust((val) =>
        dispatch({
          type: "stake/select",
          data: val,
        })
      );
  }, [address, opportunities.data]);

  const selectedStakeId = selectedStake.mapOrDefault((s) => s.id, "");

  const { data: validators } = useStakeGetValidators(selectedStakeId, {
    query: { enabled: !!selectedStakeId },
  });

  /**
   * Set initial validator
   */
  useEffect(() => {
    selectedValidator.ifNothing(() => {
      Maybe.fromNullable(validators)
        .chain((v) => selectedStake.map((ss) => ({ v, ss })))
        .toEither(null)
        .chain((val) =>
          List.find(
            (item) =>
              !!(
                item.address &&
                val.ss.config.defaultValidator &&
                item.address === val.ss.config.defaultValidator
              ),
            val.v
          )
            .toEither(null)
            .chainLeft(() => List.head(val.v).toEither(null))
        )
        .ifRight((val) => dispatch({ type: "validator/select", data: val }));
    });
  }, [selectedStake, selectedValidator, validators]);

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
