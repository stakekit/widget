import type {
  ActionDto,
  ActionRequestDto,
  TokenDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
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
  unstakeAmount: BigNumber;
  integrationData: YieldDto;
  unstakeToken: TokenDto;
  actionDto: Maybe<ActionDto>;
}>;

const ExitStakeStateContext = createContext<State | undefined>(undefined);

const ExitStakeDispatchContext = createContext<
  Dispatch<SetStateAction<State>> | undefined
>(undefined);

export const ExitStakeProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<State>(() => Maybe.empty());

  return (
    <ExitStakeStateContext.Provider value={state}>
      <ExitStakeDispatchContext.Provider value={setState}>
        {children}
      </ExitStakeDispatchContext.Provider>
    </ExitStakeStateContext.Provider>
  );
};

export const useExitStakeState = () => {
  const value = useContext(ExitStakeStateContext);

  if (!value) {
    throw new Error(
      "useExitStakeState must be used within a ExitStakeProvider"
    );
  }

  return value;
};

export const useExitStakeStateDispatch = () => {
  const dispatch = useContext(ExitStakeDispatchContext);

  if (!dispatch) {
    throw new Error(
      "useExitStakeStateDispatch must be used within a ExitStakeProvider"
    );
  }

  return dispatch;
};
