import type { TransactionType } from "@stakekit/api-hooks";
import { createContext, type PropsWithChildren, useContext } from "react";

type CompleteCommonContextType = {
  urls: {
    type: TransactionType;
    url: string;
  }[];
  unstakeMatch: boolean;
  pendingActionMatch: boolean;
  onViewTransactionClick: (url: string) => void;
};

export const CompleteCommonContext = createContext<CompleteCommonContextType>({
  urls: [],
  unstakeMatch: false,
  pendingActionMatch: false,
  onViewTransactionClick: () => {},
});

export const CompleteCommonContextProvider = ({
  children,
  value,
}: PropsWithChildren<{
  value: CompleteCommonContextType;
}>) => {
  return (
    <CompleteCommonContext.Provider value={value}>
      {children}
    </CompleteCommonContext.Provider>
  );
};

export const useCompleteCommonContext = () => {
  const context = useContext(CompleteCommonContext);

  if (!context) {
    throw new Error(
      "useCompleteCommonContext must be used within a CompleteCommonContextProvider"
    );
  }

  return context;
};
