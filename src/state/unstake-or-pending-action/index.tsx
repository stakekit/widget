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
import { Action } from "../stake/types";
import { useStakeExitAndTxsConstruct } from "../../hooks/api/use-stake-exit-and-txs-construct";
import { ActionDto, YieldDto } from "@stakekit/api-hooks";
import { usePendingActionAndTxsConstruct } from "../../hooks/api/use-pending-action-and-txs-construct";

type UnstakeAmountChange = Action<
  "unstake/amount/change",
  { integration: YieldDto; amount: Maybe<BigNumber> }
>;

type Actions = UnstakeAmountChange;

const getInitialState = (): State => ({
  unstake: Maybe.empty(),
});

export type State = {
  unstake: Maybe<{
    integration: YieldDto;
    amount: Maybe<BigNumber>;
  }>;
};

type ExtraData = {
  stakeExitTxGas: Maybe<BigNumber>;
  pendingActionTxGas: Maybe<BigNumber>;
  unstakeSession: Maybe<ActionDto>;
  pendingActionSession: Maybe<ActionDto>;
};

const UnstakeOrPendingActionContext = createContext<
  (State & ExtraData) | undefined
>(undefined);

const UnstakeOrPendingActionDispatchContext = createContext<
  Dispatch<Actions> | undefined
>(undefined);

export const UnstakeOrPendingActionContextProvider = ({
  children,
}: PropsWithChildren) => {
  const reducer = (state: State, action: Actions): State => {
    switch (action.type) {
      case "unstake/amount/change": {
        return {
          ...state,
          unstake: Maybe.of(action.data),
        };
      }

      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, getInitialState());

  const stakeExitAndTxsConstruct = useStakeExitAndTxsConstruct();
  const pendingActionAndTxsConstruct = usePendingActionAndTxsConstruct();

  const unstakeSession = useMemo(
    () => Maybe.fromNullable(stakeExitAndTxsConstruct.data?.stakeExitRes),
    [stakeExitAndTxsConstruct.data?.stakeExitRes]
  );

  const pendingActionSession = useMemo(
    () =>
      Maybe.fromNullable(pendingActionAndTxsConstruct.data?.pendingActionRes),
    [pendingActionAndTxsConstruct.data?.pendingActionRes]
  );

  const stakeExitTxGas = useMemo(() => {
    return Maybe.fromNullable(stakeExitAndTxsConstruct.data).map((val) =>
      val.transactionConstructRes.reduce(
        (acc, val) => acc.plus(new BigNumber(val.gasEstimate?.amount ?? 0)),
        new BigNumber(0)
      )
    );
  }, [stakeExitAndTxsConstruct.data]);

  const pendingActionTxGas = useMemo(() => {
    return Maybe.fromNullable(pendingActionAndTxsConstruct.data).map((val) =>
      val.transactionConstructRes.reduce(
        (acc, val) => acc.plus(new BigNumber(val.gasEstimate?.amount ?? 0)),
        new BigNumber(0)
      )
    );
  }, [pendingActionAndTxsConstruct.data]);

  const value: State & ExtraData = useMemo(
    () => ({
      stakeExitTxGas,
      unstakeSession,
      pendingActionSession,
      unstake: state.unstake,
      pendingActionTxGas,
    }),
    [
      stakeExitTxGas,
      state.unstake,
      unstakeSession,
      pendingActionSession,
      pendingActionTxGas,
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
