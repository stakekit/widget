import { createContext, type PropsWithChildren, useContext } from "react";

const DashboardContext = createContext<boolean>(false);

export const DashboardProvider = ({ children }: PropsWithChildren) => {
  return (
    <DashboardContext.Provider value={true}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useIsDashboard = () => !!useContext(DashboardContext);
