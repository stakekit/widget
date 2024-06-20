import type {
  ActionDto,
  ActionRequestDto,
  TokenDto,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import {
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
  createContext,
  useContext,
  useState,
} from "react";

type State = Maybe<{
  requestDto: ActionRequestDto;
  gasFeeToken: YieldDto["token"];
  selectedStake: YieldDto;
  selectedValidators: Map<string, ValidatorDto>;
  selectedToken: TokenDto;
  actionDto: Maybe<ActionDto>;
}>;

const EnterStakeStateContext = createContext<State | undefined>(undefined);

const EnterStakeDispatchContext = createContext<
  Dispatch<SetStateAction<State>> | undefined
>(undefined);

export const EnterStakeProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<State>(() => Maybe.empty());

  return (
    <EnterStakeStateContext.Provider value={state}>
      <EnterStakeDispatchContext.Provider value={setState}>
        {children}
      </EnterStakeDispatchContext.Provider>
    </EnterStakeStateContext.Provider>
  );
};

export const useEnterStakeState = () => {
  const value = useContext(EnterStakeStateContext);

  if (!value) {
    throw new Error(
      "useEnterStakeState must be used within a EnterStakeProvider"
    );
  }

  return value;
};

export const useEnterStakeDispatch = () => {
  const dispatch = useContext(EnterStakeDispatchContext);

  if (!dispatch) {
    throw new Error(
      "useEnterStakeDispatch must be used within a EnterStakeProvider"
    );
  }

  return dispatch;
};
