import { createContext, type ReactNode, useContext } from "react";

const ApplicationRouteContentContext = createContext<ReactNode>(null);

export const ApplicationRouteContentProvider =
  ApplicationRouteContentContext.Provider;

export const ApplicationRouteRoot = () => {
  return useContext(ApplicationRouteContentContext);
};
