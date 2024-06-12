import type {
  ActionDto,
  ActionRequestDto,
  TokenDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import {
  type Dispatch,
  type SetStateAction,
  createContext,
  useContext,
  useState,
} from "react";

type State =
  | {
      gasFeeToken: YieldDto["token"];
      dto: ActionRequestDto;
      unstakeAmount: BigNumber;
      integrationData: YieldDto;
      unstakeToken: TokenDto;
      val?: ActionDto;
    }
  | undefined;

const ExitStakeRequestDtoContext = createContext<State | undefined>(undefined);

const ExitStakeRequestDtoDispatchContext = createContext<
  Dispatch<SetStateAction<State>> | undefined
>(undefined);

export const ExitStakeRequestDtoProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [state, setState] = useState<State>(undefined);

  return (
    <ExitStakeRequestDtoContext.Provider value={state}>
      <ExitStakeRequestDtoDispatchContext.Provider value={setState}>
        {children}
      </ExitStakeRequestDtoDispatchContext.Provider>
    </ExitStakeRequestDtoContext.Provider>
  );
};

export const useExitStakeRequestDto = () =>
  useContext(ExitStakeRequestDtoContext);

export const useExitStakeRequestDtoDispatch = () => {
  const dispatch = useContext(ExitStakeRequestDtoDispatchContext);

  if (!dispatch) {
    throw new Error(
      "useExitStakeRequestDtoDispatch must be used within a ExitStakeRequestDtoProvider"
    );
  }

  return dispatch;
};
