import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { StateSnapshot, VirtuosoHandle } from "react-virtuoso";
import { useLocationTransition } from "../location-transition";

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

export const useListState = () => {
  const context = useContext(ListStateContext);

  if (!context) {
    throw new Error(
      "useListStateContext must be used within a ListStateContextProvider"
    );
  }

  return context;
};

export const useHandleListState = () => {
  const { location, displayLocation } = useLocationTransition();

  const virtualListRef = useRef<VirtuosoHandle>(null);

  const [state, setState] = useListState();

  useEffect(() => {
    const list = virtualListRef.current;

    return () => {
      list?.getState((newState) => {
        setState((prev) => ({ ...prev, positions: newState }));
      });
    };
  }, [displayLocation.pathname, location.pathname, setState]);

  return { scrollTop: state.positions?.scrollTop ?? undefined, virtualListRef };
};
