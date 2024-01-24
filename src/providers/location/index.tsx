import { createContext, useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { usePrevious } from "../../hooks/use-previous";

const SKLocationContext = createContext<
  | {
      current: ReturnType<typeof useLocation>;
      prev: ReturnType<typeof useLocation> | null;
    }
  | undefined
>(undefined);

export const SKLocationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const location = useLocation();
  const prevLocation = usePrevious(location);

  const value = useMemo(() => {
    return {
      current: location,
      prev: prevLocation,
    };
  }, [location, prevLocation]);

  return (
    <SKLocationContext.Provider value={value}>
      {children}
    </SKLocationContext.Provider>
  );
};

export const useSKLocation = () => {
  const location = useContext(SKLocationContext);

  if (!location) {
    throw new Error("useSKLocation must be used within a SKLocationProvider");
  }

  return location;
};
