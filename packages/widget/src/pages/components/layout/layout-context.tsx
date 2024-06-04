import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useSavedRef } from "../../../hooks";

type CurrentLayoutContextValue = {
  setState: (args: { pathname: string; height: number }) => void;
  state: {
    pathname: string;
    height: number;
  } | null;
};

const CurrentLayoutContext = createContext<
  CurrentLayoutContextValue | undefined
>(undefined);

export const CurrentLayoutProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<CurrentLayoutContextValue["state"]>(null);

  const { pathname: currentPathname } = useLocation();

  const currentPathnameRef = useSavedRef(currentPathname);

  const _setState = useCallback<CurrentLayoutContextValue["setState"]>(
    ({ height, pathname }) => {
      if (currentPathnameRef.current !== pathname) return;

      setState({ pathname, height });
    },
    [currentPathnameRef]
  );

  const value = useMemo(
    () => ({ state, setState: _setState }),
    [_setState, state]
  );

  return (
    <CurrentLayoutContext.Provider value={value}>
      {children}
    </CurrentLayoutContext.Provider>
  );
};

export const useCurrentLayout = () => {
  const value = useContext(CurrentLayoutContext);

  if (!value) {
    throw new Error(
      "useCurrentLayout must be used within a CurrentLayoutContextProvider"
    );
  }

  return value;
};
