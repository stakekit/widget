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
import { useStakeExitAndTxsConstructMutationState } from "../../hooks/api/use-stake-exit-and-txs-construct";
import { ActionDto, TokenDto, YieldDto } from "@stakekit/api-hooks";
import { usePendingActionAndTxsConstructMutationState } from "../../hooks/api/use-pending-action-and-txs-construct";
import { useOnPendingActionMutationState } from "../../pages/position-details/hooks/use-on-pending-action";

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
  pendingAction: Maybe<{ token: TokenDto }>;
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

  const stakeExitAndTxsConstructMutationState =
    useStakeExitAndTxsConstructMutationState();
  const pendingActionAndTxsConstructMutationState =
    usePendingActionAndTxsConstructMutationState();

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

  const stakeExitTxGas = useMemo(() => {
    return Maybe.fromNullable(stakeExitAndTxsConstructMutationState?.data).map(
      (val) =>
        val.transactionConstructRes.reduce(
          (acc, val) => acc.plus(new BigNumber(val.gasEstimate?.amount ?? 0)),
          new BigNumber(0)
        )
    );
  }, [stakeExitAndTxsConstructMutationState]);

  const pendingActionTxGas = useMemo(
    () =>
      Maybe.fromNullable(pendingActionAndTxsConstructMutationState?.data).map(
        (val) =>
          val.transactionConstructRes.reduce(
            (acc, val) => acc.plus(new BigNumber(val.gasEstimate?.amount ?? 0)),
            new BigNumber(0)
          )
      ),
    [pendingActionAndTxsConstructMutationState?.data]
  );

  const onPendingActionState = useOnPendingActionMutationState();

  const pendingAction = useMemo<ExtraData["pendingAction"]>(
    () =>
      Maybe.fromNullable(onPendingActionState?.data).map((val) => ({
        token: val.yieldBalance.token,
      })),
    [onPendingActionState?.data]
  );

  const value: State & ExtraData = useMemo(
    () => ({
      stakeExitTxGas,
      unstakeSession,
      pendingActionSession,
      unstake: state.unstake,
      pendingActionTxGas,
      pendingAction,
    }),
    [
      stakeExitTxGas,
      unstakeSession,
      pendingActionSession,
      state.unstake,
      pendingActionTxGas,
      pendingAction,
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
