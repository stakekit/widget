import type { PropsWithChildren } from "react";
import { createContext, useContext, useLayoutEffect, useState } from "react";
import { MaybeDocument } from "../../utils/maybe-document";
import { rootSelector } from "../../styles";

const RootElementContext = createContext<HTMLElement | null>(null);

export const RootElementProvider = ({ children }: PropsWithChildren) => {
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    MaybeDocument.chainNullable(
      (doc) => doc.querySelector(rootSelector) as HTMLElement
    ).ifJust((el) => setRootElement(el));
  }, [rootElement]);

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
