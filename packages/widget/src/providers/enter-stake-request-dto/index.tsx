import type {
  ActionDto,
  ActionRequestDto,
  TokenDto,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
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
      selectedStake: YieldDto;
      selectedValidators: Map<string, ValidatorDto>;
      selectedToken: TokenDto;
      val?: ActionDto;
    }
  | undefined;

const EnterStakeRequestDtoContext = createContext<State | undefined>(undefined);

const EnterStakeRequestDtoDispatchContext = createContext<
  Dispatch<SetStateAction<State>> | undefined
>(undefined);

export const EnterStakeRequestDtoProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [state, setState] = useState<State>(undefined);

  return (
    <EnterStakeRequestDtoContext.Provider value={state}>
      <EnterStakeRequestDtoDispatchContext.Provider value={setState}>
        {children}
      </EnterStakeRequestDtoDispatchContext.Provider>
    </EnterStakeRequestDtoContext.Provider>
  );
};

export const useEnterStakeRequestDto = () => {
  const state = useContext(EnterStakeRequestDtoContext);

  // if (!state) {
  //   throw new Error(
  //     "useEnterStakeRequestDto must be used within a EnterStakeRequestDtoProvider"
  //   );
  // }
  return state;
};

export const useEnterStakeRequestDtoDispatch = () => {
  const dispatch = useContext(EnterStakeRequestDtoDispatchContext);

  if (!dispatch) {
    throw new Error(
      "useEnterStakeRequestDtoDispatch must be used within a EnterStakeRequestDtoProvider"
    );
  }

  return dispatch;
};
