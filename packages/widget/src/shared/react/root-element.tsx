import type { PropsWithChildren } from "react";
import { createContext, useContext, useLayoutEffect, useState } from "react";
import { rootSelector } from "../styles/theme/ids";

const RootElementContext = createContext<HTMLElement | null | undefined>(
  undefined
);

export const RootElementProvider = ({ children }: PropsWithChildren) => {
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const element = document.querySelector(rootSelector) as HTMLElement | null;
    if (element) setRootElement(element);
  }, []);

  return (
    <RootElementContext.Provider value={rootElement}>
      {children}
    </RootElementContext.Provider>
  );
};

export const useRootElement = () => {
  const value = useContext(RootElementContext);

  if (value === undefined) {
    throw new Error("RootElementProvider not found in the tree");
  }

  return value;
};
