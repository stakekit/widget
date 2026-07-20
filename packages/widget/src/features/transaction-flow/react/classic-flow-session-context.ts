import { createContext, useContext } from "react";
import type { ClassicFlowSessionFacade } from "../state/classic-flow-session-facade";

export const ClassicFlowSessionContext =
  createContext<ClassicFlowSessionFacade | null>(null);

export const useClassicFlowSessionFacade = () => {
  const facade = useContext(ClassicFlowSessionContext);

  if (!facade) {
    throw new Error("Classic Flow Session used outside its route boundary.");
  }

  return facade;
};
