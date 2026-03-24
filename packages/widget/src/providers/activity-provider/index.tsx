import { createStore } from "@xstate/store";
import { Maybe } from "purify-ts";
import { createContext, type PropsWithChildren, useContext } from "react";
import type { ActionDto } from "../../domain/types/action";
import type { Yield } from "../../domain/types/yields";

const store = createStore({
  context: {
    selectedAction: Maybe.empty() as Maybe<ActionDto>,
    selectedYield: Maybe.empty() as Maybe<Yield>,
  },
  on: {
    setSelectedAction: (
      _,
      event: {
        data: Maybe<{ selectedAction: ActionDto; selectedYield: Yield }>;
      },
    ) => ({
      selectedAction: event.data.map(({ selectedAction }) => selectedAction),
      selectedYield: event.data.map(({ selectedYield }) => selectedYield),
    }),
  },
});

const ActivityContext = createContext<typeof store | undefined>(undefined);

export const ActivityProvider = ({ children }: PropsWithChildren) => {
  return (
    <ActivityContext.Provider value={store}>
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivityContext = () => {
  const value = useContext(ActivityContext);

  if (!value) {
    throw new Error(
      "useActivityContext must be used within a ActivityProvider",
    );
  }

  return value;
};
