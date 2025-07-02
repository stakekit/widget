import type {
  ActionDto,
  ActionRequestDto,
  TokenDto,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { createStore } from "@xstate/store";
import { Maybe } from "purify-ts";
import { createContext, type PropsWithChildren, useContext } from "react";

type InitData = {
  requestDto: ActionRequestDto;
  gasFeeToken: YieldDto["token"];
  selectedStake: YieldDto;
  selectedValidators: Map<string, ValidatorDto>;
  selectedToken: TokenDto;
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

const EnterStakeStoreContext = createContext<typeof store | undefined>(
  undefined
);

export const EnterStakeStoreProvider = ({ children }: PropsWithChildren) => {
  return (
    <EnterStakeStoreContext.Provider value={store}>
      {children}
    </EnterStakeStoreContext.Provider>
  );
};

export const useEnterStakeStore = () => {
  const value = useContext(EnterStakeStoreContext);

  if (!value) {
    throw new Error(
      "useEnterStakeStore must be used within a EnterStakeStoreProvider"
    );
  }

  return value;
};
