import type { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { createContext, useState } from "react";

type ListStateContextType = { [Key in "positions"]: null };

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
