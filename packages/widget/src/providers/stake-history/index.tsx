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

type Data = Maybe<GenericData>;

const ActionHistoryContext = createContext<
  readonly [Data, () => void] | undefined
>(undefined);

export const ActionHistoryContextProvider = ({
  children,
}: PropsWithChildren) => {
  const [data, setData] = useState<Data>(Maybe.empty());

  const setActionHistoryData = useCallback(() => {
    setData(Maybe.of({ timestamp: Date.now() }));
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
