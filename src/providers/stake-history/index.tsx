import type {
  ActionTypes,
  TokenDto,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type GenericData = { timestamp: number };
type TypeData = {
  integrationData: YieldDto;
  amount: BigNumber;
  interactedToken: TokenDto;
} & (
  | {
      type: "stake";
      selectedValidators: Map<ValidatorDto["address"], ValidatorDto>;
    }
  | { type: "unstake" }
  | { type: "pending_action"; pendingActionType: ActionTypes }
);

type Data = Maybe<GenericData & TypeData>;

const ActionHistoryContext = createContext<
  readonly [Data, (data: TypeData) => void] | undefined
>(undefined);

export const ActionHistoryContextProvider = ({
  children,
}: PropsWithChildren) => {
  const [data, setData] = useState<Data>(Maybe.empty());

  const setActionHistoryData = useCallback((data: TypeData) => {
    setData(Maybe.of({ ...data, timestamp: Date.now() }));
  }, []);

  const value = useMemo(
    () => [data, setActionHistoryData] as const,
    [data, setActionHistoryData]
  );

  return (
    <ActionHistoryContext.Provider value={value}>
      {children}
    </ActionHistoryContext.Provider>
  );
};

const useActionHistory = () => {
  const context = useContext(ActionHistoryContext);

  if (context === undefined) {
    throw new Error(
      "useActionHistory must be used within a ActionHistoryContextProvider"
    );
  }

  return context;
};

export const useActionHistoryData = () => useActionHistory()[0];
export const useSetActionHistoryData = () => useActionHistory()[1];
