import { createStore } from "@xstate/store";
import type BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { createContext, type PropsWithChildren, useContext } from "react";
import type {
  ActionDto,
  YieldCreateActionDto,
} from "../../domain/types/action";
import type { AddressesDto } from "../../domain/types/addresses";
import type { TokenDto, YieldTokenDto } from "../../domain/types/tokens";
import type { Yield } from "../../domain/types/yields";

type InitData = {
  requestDto: YieldCreateActionDto;
  addresses: AddressesDto;
  gasFeeToken: Yield["token"];
  unstakeAmount: BigNumber;
  integrationData: Yield;
  unstakeToken: TokenDto | YieldTokenDto;
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
