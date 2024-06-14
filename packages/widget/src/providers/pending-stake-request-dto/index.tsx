import type {
  ActionDto,
  ActionTypes,
  AddressesDto,
  PendingActionRequestDto,
  TokenDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import {
  type Dispatch,
  type SetStateAction,
  createContext,
  useContext,
  useState,
} from "react";

type State =
  | ({
      address: AddressesDto["address"] | null;
      pendingActionType: Maybe<ActionTypes>;
      pendingActionData: {
        integrationData: YieldDto;
        interactedToken: TokenDto;
      };
      gasFeeToken: TokenDto;
      actionDto?: ActionDto;
    } & PendingActionRequestDto)
  | undefined;

const PendingStakeRequestDtoContext = createContext<State | undefined>(
  undefined
);

const PendingStakeRequestDtoDispatchContext = createContext<
  Dispatch<SetStateAction<State>> | undefined
>(undefined);

export const PendingStakeRequestDtoProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [state, setState] = useState<State>(undefined);

  return (
    <PendingStakeRequestDtoContext.Provider value={state}>
      <PendingStakeRequestDtoDispatchContext.Provider value={setState}>
        {children}
      </PendingStakeRequestDtoDispatchContext.Provider>
    </PendingStakeRequestDtoContext.Provider>
  );
};

export const usePendingStakeRequestDto = () =>
  useContext(PendingStakeRequestDtoContext);

export const usePendingStakeRequestDtoDispatch = () => {
  const dispatch = useContext(PendingStakeRequestDtoDispatchContext);

  if (!dispatch) {
    throw new Error(
      "usePendingStakeRequestDtoDispatch must be used within a PendingStakeRequestDtoProvider"
    );
  }

  return dispatch;
};
