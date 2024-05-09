import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import type { Dispatch, PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { Actions, ExtraData, State } from "./types";
import {
  StakeEnterAndTxsConstructProvider,
  useStakeEnterAndTxsConstruct,
} from "../../hooks/api/use-stake-enter-and-txs-construct";
import { useMaxMinYieldAmount } from "../../hooks/use-max-min-yield-amount";
import { useYieldOpportunity } from "../../hooks/api/use-yield-opportunity";
import { useForceMaxAmount } from "../../hooks/use-force-max-amount";
import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { useSKWallet } from "../../providers/sk-wallet";
import { useInitQueryParams } from "../../hooks/use-init-query-params";
import { PendingActionAndTxsConstructContextProvider } from "../../hooks/api/use-pending-action-and-txs-construct";
import { StakeExitAndTxsConstructContextProvider } from "../../hooks/api/use-stake-exit-and-txs-construct";
import { OnPendingActionProvider } from "../../pages/position-details/hooks/use-on-pending-action";
import { useAmountValidation } from "./use-amount-validation";
import { equalTokens } from "../../domain";
import { useGetInitYield } from "./use-get-init-yield";
import { useInitToken } from "./use-init-token";
import { onYieldSelectState } from "./utils";
import { useTokenBalance } from "./use-token-balance";
import { useInitYield } from "./use-init-yield";

const StakeStateContext = createContext<(State & ExtraData) | undefined>(
  undefined
);
const StakeDispatchContext = createContext<Dispatch<Actions> | undefined>(
  undefined
);

const getInitialState = (): State => ({
  selectedToken: Maybe.empty(),
  selectedStakeId: Maybe.empty(),
  selectedValidators: new Map(),
  stakeAmount: new BigNumber(0),
  tronResource: Maybe.empty(),
});

const Provider = ({ children }: PropsWithChildren) => {
  const initParams = useInitQueryParams();
  const { network } = useSKWallet();

  const getInitYield = useGetInitYield();

  const reducer = (state: State, action: Actions): State => {
    switch (action.type) {
      case "token/select": {
        const diffToken = state.selectedToken
          .map((v) => !equalTokens(v, action.data))
          .orDefault(true);

        if (!diffToken) return state;

        const initYieldState = getInitYield({ selectedToken: action.data })
          .map((val) =>
            onYieldSelectState({
              initParams: Maybe.fromNullable(initParams.data),
              yieldDto: val,
            })
          )
          .extract();

        return {
          ...getInitialState(),
          selectedToken: Maybe.of(action.data),
          ...initYieldState,
        };
      }

      case "yield/select": {
        const diffYield = state.selectedStakeId
          .map((v) => v !== action.data.id)
          .orDefault(true);

        const initYieldState = onYieldSelectState({
          initParams: Maybe.fromNullable(initParams.data),
          yieldDto: action.data,
        });

        return Maybe.fromFalsy(diffYield)
          .map(() => ({
            ...getInitialState(),
            selectedToken: state.selectedToken,
            ...initYieldState,
          }))
          .orDefault(state);
      }

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
    selectedToken,
    selectedStakeId,
    selectedValidators,
    stakeAmount: _stakeAmount,
    tronResource,
  } = state;

  const initTokenRes = useInitToken();
  const initToken = useMemo(
    () => Maybe.fromNullable(initTokenRes.data),
    [initTokenRes.data]
  );

  const initYieldRes = useInitYield({ selectedToken });
  const initYield = useMemo(
    () => Maybe.fromNullable(initYieldRes.data),
    [initYieldRes.data]
  );

  const { availableAmount, availableYields } = useTokenBalance({
    selectedToken,
  });

  const yieldOpportunity = useYieldOpportunity(selectedStakeId.extract());

  const { minEnterOrExitAmount, maxEnterOrExitAmount } = useMaxMinYieldAmount({
    type: "enter",
    yieldOpportunity: Maybe.fromNullable(yieldOpportunity.data),
    availableAmount,
  });

  const selectedStake = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const forceMax = useForceMaxAmount({
    integration: selectedStake,
    type: "enter",
  });

  /**
   * If stake amount is less then min, use min
   */
  const stakeAmount = useMemo(
    () => (forceMax ? maxEnterOrExitAmount : _stakeAmount),
    [forceMax, maxEnterOrExitAmount, _stakeAmount]
  );

  const setToken = useCallback(
    (token: TokenDto) => dispatch({ type: "token/select", data: token }),
    []
  );

  const setYield = useCallback(
    (yieldDto: YieldDto) => dispatch({ type: "yield/select", data: yieldDto }),
    []
  );

  /**
   * Reset selectedToken if we changed network
   */
  selectedToken.ifJust((ss) => {
    if (network && ss.network !== network) {
      dispatch({ type: "state/reset" });
    }
  });

  /**
   * Set initial token
   */
  useEffect(() => {
    initToken.ifJust(setToken);
  }, [initToken, setToken]);

  useEffect(() => {
    selectedToken.ifNothing(() => initToken.ifJust(setToken));
  }, [initToken, selectedToken, setToken]);

  /**
   * Set initial yield
   */
  useEffect(() => {
    initYield.ifJust(setYield);
  }, [initYield, setYield]);

  useEffect(() => {
    selectedStakeId.ifNothing(() => initYield.ifJust(setYield));
  }, [initYield, selectedStakeId, setYield]);

  /**
   * Reset selectedToken if we dont have initToken
   * Case when we changed account, but we dont have available yields
   */
  useEffect(() => {
    initToken.ifNothing(() =>
      selectedToken.ifJust(() => dispatch({ type: "state/reset" }))
    );
  }, [initToken, selectedToken]);

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
      onMaxClick: () =>
        dispatch({ type: "stakeAmount/max", data: maxEnterOrExitAmount }),
    }),
    [maxEnterOrExitAmount]
  );

  const {
    stakeAmountGreaterThanAvailableAmount,
    stakeAmountGreaterThanMax,
    stakeAmountLessThanMin,
    stakeAmountIsZero,
  } = useAmountValidation({
    availableAmount,
    stakeAmount,
    maxEnterOrExitAmount,
    minEnterOrExitAmount,
  });

  const value: State & ExtraData = useMemo(
    () => ({
      selectedStakeId,
      selectedStake,
      selectedValidators,
      stakeAmount,
      stakeSession,
      actions,
      stakeEnterTxGas,
      tronResource,
      isGasCheckError,
      stakeAmountGreaterThanAvailableAmount,
      stakeAmountGreaterThanMax,
      stakeAmountLessThanMin,
      stakeAmountIsZero,
      availableAmount,
      availableYields,
      selectedToken,
    }),
    [
      selectedStakeId,
      selectedStake,
      selectedToken,
      selectedValidators,
      stakeAmount,
      stakeSession,
      actions,
      stakeEnterTxGas,
      tronResource,
      isGasCheckError,
      stakeAmountGreaterThanAvailableAmount,
      stakeAmountGreaterThanMax,
      stakeAmountLessThanMin,
      stakeAmountIsZero,
      availableAmount,
      availableYields,
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
