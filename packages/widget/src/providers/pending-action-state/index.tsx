import type {
  ActionDto,
  ActionTypes,
  AddressesDto,
  PendingActionRequestDto,
  TokenDto,
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
  requestDto: PendingActionRequestDto;
  addresses: AddressesDto;
  pendingActionType: ActionTypes;
  integrationData: YieldDto;
  interactedToken: TokenDto;
  gasFeeToken: TokenDto;
  actionDto: Maybe<ActionDto>;
}>;

const PendingActionStateContext = createContext<State | undefined>(undefined);

const PendingActionDispatchContext = createContext<
  Dispatch<SetStateAction<State>> | undefined
>(undefined);

export const PendingActionProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<State>(() => Maybe.empty());

  return (
    <PendingActionStateContext.Provider value={state}>
      <PendingActionDispatchContext.Provider value={setState}>
        {children}
      </PendingActionDispatchContext.Provider>
    </PendingActionStateContext.Provider>
  );
};

export const usePendingActionState = () => {
  const value = useContext(PendingActionStateContext);

  if (!value) {
    throw new Error(
      "usePendingActionState must be used within a PendingActionProvider"
    );
  }

  return value;
};

export const usePendingActionDispatch = () => {
  const dispatch = useContext(PendingActionDispatchContext);

  if (!dispatch) {
    throw new Error(
      "usePendingActionDispatch must be used within a PendingActionProvider"
    );
  }

  return dispatch;
};
