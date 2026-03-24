import type { PropsWithChildren } from "react";
import { createContext, useContext, useLayoutEffect, useState } from "react";
import { rootSelector } from "../../styles/theme/ids";
import { MaybeDocument } from "../../utils/maybe-document";

const RootElementContext = createContext<HTMLElement | null | undefined>(
  undefined
);

export const RootElementProvider = ({ children }: PropsWithChildren) => {
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    MaybeDocument.chainNullable(
      (doc) => doc.querySelector(rootSelector) as HTMLElement
    ).ifJust((el) => setRootElement(el));
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
