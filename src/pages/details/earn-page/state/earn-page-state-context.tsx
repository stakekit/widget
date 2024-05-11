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
import { useMaxMinYieldAmount } from "../../../../hooks/use-max-min-yield-amount";
import { useYieldOpportunity } from "../../../../hooks/api/use-yield-opportunity";
import { useForceMaxAmount } from "../../../../hooks/use-force-max-amount";
import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useInitQueryParams } from "../../../../hooks/use-init-query-params";
import { useAmountValidation } from "./use-amount-validation";
import { equalTokens } from "../../../../domain";
import { useGetInitYield } from "./use-get-init-yield";
import { useInitToken } from "./use-init-token";
import { onYieldSelectState } from "./utils";
import { useTokenBalance } from "./use-token-balance";
import { useInitYield } from "./use-init-yield";
import { useSavedRef } from "../../../../hooks";

const EarnPageStateContext = createContext<(State & ExtraData) | undefined>(
  undefined
);
const EarnPageDispatchContext = createContext<Dispatch<Actions> | undefined>(
  undefined
);

const getInitialState = (): State => ({
  selectedToken: Maybe.empty(),
  selectedStakeId: Maybe.empty(),
  selectedValidators: new Map(),
  stakeAmount: new BigNumber(0),
  tronResource: Maybe.empty(),
});

export const EarnPageStateProvider = ({ children }: PropsWithChildren) => {
  const initParams = useInitQueryParams();
  const { network, isConnected } = useSKWallet();

  const getInitYield = useGetInitYield();

  const reducer = (state: State, action: Actions): State => {
    switch (action.type) {
      case "token/select": {
        return Maybe.fromFalsy(
          state.selectedToken
            .map((v) => !equalTokens(v, action.data))
            .orDefault(true)
        )
          .chain(() =>
            getInitYield({ selectedToken: action.data })
              .map<ReturnType<typeof onYieldSelectState> | null>((val) =>
                onYieldSelectState({
                  initParams: Maybe.fromNullable(initParams.data),
                  yieldDto: val,
                })
              )
              .alt(Maybe.of(null))
          )
          .map((val) => ({
            ...getInitialState(),
            selectedToken: Maybe.of(action.data),
            ...val,
          }))
          .orDefault(state);
      }

      case "yield/select": {
        return Maybe.fromFalsy(
          state.selectedStakeId.map((v) => v !== action.data.id).orDefault(true)
        )
          .map(() =>
            onYieldSelectState({
              initParams: Maybe.fromNullable(initParams.data),
              yieldDto: action.data,
            })
          )
          .map((val) => ({
            ...getInitialState(),
            selectedToken: state.selectedToken,
            ...val,
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

  const selectedTokenRef = useSavedRef(selectedToken);
  const initTokenRef = useSavedRef(initToken);
  const initYieldRef = useSavedRef(initYield);

  useEffect(() => {
    if (!isConnected && selectedTokenRef.current.isJust()) {
      dispatch({ type: "state/reset" });
    }
  }, [selectedTokenRef, isConnected]);

  /**
   * Set initial token
   */
  useEffect(() => {
    initToken.ifJust(setToken);
  }, [initToken, setToken]);

  useEffect(() => {
    selectedToken.ifNothing(() => initTokenRef.current.ifJust(setToken));
  }, [initTokenRef, selectedToken, setToken]);

  /**
   * Set initial yield
   */
  useEffect(() => {
    initYield.ifJust(setYield);
  }, [initYield, setYield]);

  useEffect(() => {
    selectedStakeId.ifNothing(() => initYieldRef.current.ifJust(setYield));
  }, [initYieldRef, selectedStakeId, setYield]);

  /**
   * Reset selectedToken if we dont have initToken
   * Case when we changed account, but we dont have available yields
   */
  useEffect(() => {
    initToken.ifNothing(() =>
      selectedToken.ifJust(() => dispatch({ type: "state/reset" }))
    );
  }, [initToken, selectedToken]);

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
      dispatch,
      selectedStakeId,
      selectedStake,
      selectedValidators,
      stakeAmount,
      actions,
      tronResource,
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
      actions,
      tronResource,
      stakeAmountGreaterThanAvailableAmount,
      stakeAmountGreaterThanMax,
      stakeAmountLessThanMin,
      stakeAmountIsZero,
      availableAmount,
      availableYields,
    ]
  );

  return (
    <EarnPageStateContext.Provider value={value}>
      <EarnPageDispatchContext.Provider value={dispatch}>
        {children}
      </EarnPageDispatchContext.Provider>
    </EarnPageStateContext.Provider>
  );
};

export const useEarnPageState = () => {
  const state = useContext(EarnPageStateContext);
  if (state === undefined) {
    throw new Error("useState must be used within a StateProvider");
  }

  return state;
};

export const useEarnPageDispatch = () => {
  const dispatch = useContext(EarnPageDispatchContext);
  if (dispatch === undefined) {
    throw new Error("useDispatch must be used within a StateProvider");
  }

  return dispatch;
};
