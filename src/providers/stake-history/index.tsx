import { ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type GenericData = { timestamp: number };
type TypeData =
  | {
      type: "stake";
      selectedStake: YieldDto;
      stakeAmount: BigNumber;
      selectedValidator: Maybe<ValidatorDto>;
    }
  | { type: "unstake" }
  | { type: "pending_action" };

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
      "useActionHistory must be used within a ActionHistoryContext"
    );
  }

  return context;
};

export const useActionHistoryData = () => useActionHistory()[0];
export const useSetActionHistoryData = () => useActionHistory()[1];
