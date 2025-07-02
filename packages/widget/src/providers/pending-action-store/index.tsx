import type {
  ActionDto,
  ActionTypes,
  AddressesDto,
  PendingActionRequestDto,
  TokenDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { createStore } from "@xstate/store";
import { Maybe } from "purify-ts";
import { createContext, type PropsWithChildren, useContext } from "react";

type InitData = {
  requestDto: PendingActionRequestDto;
  addresses: AddressesDto;
  pendingActionType: ActionTypes;
  integrationData: YieldDto;
  interactedToken: TokenDto;
  gasFeeToken: TokenDto;
};

type Store = Maybe<InitData & { actionDto: Maybe<ActionDto> }>;

const store = createStore({
  context: { data: Maybe.empty() as Store },
  on: {
    initFlow: (_, event: { data: InitData }) => ({
      data: Maybe.of({ ...event.data, actionDto: Maybe.empty() }),
    }),
    setActionDto: (context, event: { data: ActionDto }) => ({
      data: context.data.map((data) => ({
        ...data,
        actionDto: Maybe.of(event.data),
      })),
    }),
  },
});

const PendingActionStoreContext = createContext<typeof store | undefined>(
  undefined
);

export const PendingActionStoreProvider = ({ children }: PropsWithChildren) => {
  return (
    <PendingActionStoreContext.Provider value={store}>
      {children}
    </PendingActionStoreContext.Provider>
  );
};

export const usePendingActionStore = () => {
  const value = useContext(PendingActionStoreContext);

  if (!value) {
    throw new Error(
      "usePendingActionStore must be used within a PendingActionProvider"
    );
  }

  return value;
};
