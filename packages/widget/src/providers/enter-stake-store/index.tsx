import { createStore } from "@xstate/store";
import { Maybe } from "purify-ts";
import { createContext, type PropsWithChildren, useContext } from "react";
import type {
  ActionDto,
  YieldCreateActionDto,
} from "../../domain/types/action";
import type { AddressesDto } from "../../domain/types/addresses";
import type { TokenDto } from "../../domain/types/tokens";
import type { ValidatorDto } from "../../domain/types/validators";
import type { Yield } from "../../domain/types/yields";

type InitData = {
  requestDto: YieldCreateActionDto;
  addresses: AddressesDto;
  gasFeeToken: Yield["token"];
  selectedStake: Yield;
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
