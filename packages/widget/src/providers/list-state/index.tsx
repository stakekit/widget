import type { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { StateSnapshot, VirtuosoHandle } from "react-virtuoso";

type ListStateContextType = { [Key in "positions"]: StateSnapshot | null };

const ListStateContext = createContext<
  | [ListStateContextType, Dispatch<SetStateAction<ListStateContextType>>]
  | undefined
>(undefined);

export const ListStateContextProvider = ({ children }: PropsWithChildren) => {
  const value = useState<ListStateContextType>({ positions: null });

  return (
    <ListStateContext.Provider value={value}>
      {children}
    </ListStateContext.Provider>
  );
};

const useListState = () => {
  const context = useContext(ListStateContext);

  if (!context) {
    throw new Error(
      "useListStateContext must be used within a ListStateContextProvider"
    );
  }

  return context;
};

export const useHandleListState = () => {
  const virtualListRef = useRef<VirtuosoHandle>(null);

  const location = useLocation();

  const [state, setState] = useListState();

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const list = virtualListRef.current;

    return () => {
      list?.getState((newState) => {
        setState((prev) => ({ ...prev, positions: newState }));
      });
    };
  }, [location.pathname, setState]);

  return { scrollTop: state.positions?.scrollTop ?? undefined, virtualListRef };
};
