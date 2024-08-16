import type {
  ActionDto,
  ActionRequestDto,
  TokenDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { createStore } from "@xstate/store";
import type BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { type PropsWithChildren, createContext, useContext } from "react";

type InitData = {
  requestDto: ActionRequestDto;
  gasFeeToken: YieldDto["token"];
  unstakeAmount: BigNumber;
  integrationData: YieldDto;
  unstakeToken: TokenDto;
};

type Store = Maybe<InitData & { actionDto: Maybe<ActionDto> }>;

const store = createStore(
  { data: Maybe.empty() as Store },
  {
    initFlow: (_, event: { data: InitData }) => ({
      data: Maybe.of({ ...event.data, actionDto: Maybe.empty() }),
    }),
    setActionDto: (context, event: { data: ActionDto }) => ({
      data: context.data.map((data) => ({
        ...data,
        actionDto: Maybe.of(event.data),
      })),
    }),
  }
);

const ExitStakeStoreContext = createContext<typeof store | undefined>(
  undefined
);

export const ExitStakeStoreProvider = ({ children }: PropsWithChildren) => {
  return (
    <ExitStakeStoreContext.Provider value={store}>
      {children}
    </ExitStakeStoreContext.Provider>
  );
};

export const useExitStakeStore = () => {
  const value = useContext(ExitStakeStoreContext);

  if (!value) {
    throw new Error(
      "useExitStakeStore must be used within a ExitStakeStoreProvider"
    );
  }

  return value;
};
