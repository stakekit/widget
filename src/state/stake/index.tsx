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
import type {
  TokenBalanceScanResponseDto,
  TokenDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { useSKWallet } from "../../providers/sk-wallet";
import { useTokenBalancesScan } from "../../hooks/api/use-token-balances-scan";
import { useDefaultTokens } from "../../hooks/api/use-default-tokens";
import { useInitQueryParams } from "../../hooks/use-init-query-params";
import { PendingActionAndTxsConstructContextProvider } from "../../hooks/api/use-pending-action-and-txs-construct";
import { StakeExitAndTxsConstructContextProvider } from "../../hooks/api/use-stake-exit-and-txs-construct";
import { OnPendingActionProvider } from "../../pages/position-details/hooks/use-on-pending-action";
import { useMultiYields } from "../../hooks/api/use-multi-yields";
import {
  getInitMinStakeAmount,
  getInitSelectedValidators,
  getInitialToken,
  getInitialYieldId,
} from "../../domain/types/stake";
import { useAmountValidation } from "./use-amount-validation";
import { equalTokens, tokenString } from "../../domain";
import type { TokenString } from "../../domain/types";

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

  const tokenBalancesScan = useTokenBalancesScan();
  const defaultTokens = useDefaultTokens();

  const tokenBalancesMap = useMemo(
    () =>
      new Map<TokenString, TokenBalanceScanResponseDto>([
        ...(defaultTokens.data ?? []).map(
          (v) => [tokenString(v.token), v] as const
        ),
        ...(tokenBalancesScan.data ?? []).map(
          (v) => [tokenString(v.token), v] as const
        ),
      ]),
    [defaultTokens.data, tokenBalancesScan.data]
  );

  const reducer = (state: State, action: Actions): State => {
    switch (action.type) {
      case "token/select": {
        const sameToken = state.selectedToken
          .map((v) => equalTokens(v, action.data))
          .orDefault(false);

        return Maybe.fromFalsy(!sameToken)
          .map(() => ({
            ...getInitialState(),
            selectedToken: Maybe.of(action.data),
          }))
          .orDefault(state);
      }

      case "yield/select": {
        const sameYield = state.selectedStakeId
          .map((v) => v === action.data.id)
          .orDefault(false);

        return Maybe.fromFalsy(!sameYield)
          .map(() => ({
            ...getInitialState(),
            selectedToken: state.selectedToken,
            selectedStakeId: Maybe.of(action.data.id),
            stakeAmount: getInitMinStakeAmount(action.data),
            selectedValidators: getInitSelectedValidators({
              initQueryParams: Maybe.fromNullable(initParams.data),
              yieldDto: action.data,
            }),
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
    selectedToken: _selectedToken,
    selectedStakeId: _selectedStakeId,
    selectedValidators,
    stakeAmount: selectedStakeAmount,
    tronResource,
  } = state;

  const yieldOpportunity = useYieldOpportunity(_selectedStakeId.extract());

  const selectedStake = useMemo(
    () => Maybe.fromNullable(yieldOpportunity.data),
    [yieldOpportunity.data]
  );

  const initToken = useMemo(
    () =>
      getInitialToken({
        defaultTokens: defaultTokens.data ?? [],
        tokenBalances: tokenBalancesScan.data ?? [],
        initQueryParams: Maybe.fromNullable(initParams.data),
      }),
    [defaultTokens.data, initParams.data, tokenBalancesScan.data]
  );

  const selectedToken = _selectedToken.alt(initToken);

  const tokenBalance = useMemo(
    () =>
      selectedToken.chainNullable((val) =>
        tokenBalancesMap.get(tokenString(val))
      ),
    [selectedToken, tokenBalancesMap]
  );

  const availableAmount = useMemo(
    () => tokenBalance.map((v) => new BigNumber(v.amount)),
    [tokenBalance]
  );

  const availableYields = useMemo(
    () => tokenBalance.map((v) => v.availableYields),
    [tokenBalance]
  );

  const { minEnterOrExitAmount, maxEnterOrExitAmount } = useMaxMinYieldAmount({
    type: "enter",
    yieldOpportunity: Maybe.fromNullable(yieldOpportunity.data),
    availableAmount,
  });

  const forceMax = useForceMaxAmount({
    integration: selectedStake,
    type: "enter",
  });

  /**
   * If stake amount is less then min, use min
   */
  const stakeAmount = useMemo(
    () => (forceMax ? maxEnterOrExitAmount : selectedStakeAmount),
    [forceMax, maxEnterOrExitAmount, selectedStakeAmount]
  );

  const multipleYields = useMultiYields(availableYields.orDefault([]));

  const initYield = useMemo(
    () =>
      Maybe.fromRecord({
        multipleYieldsData: Maybe.fromNullable(multipleYields.data),
        availableAmount,
      }).chain((val) =>
        getInitialYieldId({
          initQueryParams: Maybe.fromNullable(initParams.data),
          yieldDtos: val.multipleYieldsData,
          tokenBalanceAmount: val.availableAmount,
        })
      ),
    [availableAmount, initParams.data, multipleYields.data]
  );

  const selectedStakeId = _selectedStakeId.alt(initYield.map((v) => v.id));

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
  _selectedToken.ifJust((ss) => {
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
    _selectedToken.ifNothing(() => initToken.ifJust(setToken));
  }, [initToken, _selectedToken, setToken]);

  /**
   * Set initial yield
   */
  useEffect(() => {
    initYield.ifJust(setYield);
  }, [initYield, setYield]);

  useEffect(() => {
    _selectedStakeId.ifNothing(() => initYield.ifJust(setYield));
  }, [initYield, _selectedStakeId, setYield]);

  /**
   * Reset selectedToken if we dont have initToken
   * Case when we changed account, but we dont have available yields
   */
  useEffect(() => {
    initToken.ifNothing(() =>
      _selectedToken.ifJust(() => dispatch({ type: "state/reset" }))
    );
  }, [initToken, _selectedToken]);

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
