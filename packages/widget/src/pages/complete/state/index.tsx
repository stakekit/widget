import { createContext, type PropsWithChildren, useContext } from "react";
import type { TransactionType } from "../../../domain/types/action";
import type { PageCta } from "../../components/page-cta";

type CompleteCommonContextType = {
  cta: PageCta;
  urls: {
    type: TransactionType;
    url: string;
  }[];
  unstakeMatch: boolean;
  pendingActionMatch: boolean;
  onViewTransactionClick: (url: string) => void;
};

const CompleteCommonContext = createContext<CompleteCommonContextType>({
  cta: null,
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
