import type { Virtualizer } from "@tanstack/react-virtual";
import { createContext, type ReactNode, useContext } from "react";

const VirtualizerObserveElementRect = createContext<
  | ((
      instance: Virtualizer<HTMLDivElement, Element>,
      cb: (rect: { width: number; height: number }) => void
    ) => void)
  | undefined
>(undefined);

export const VirtualizerObserveElementRectProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  return (
    <VirtualizerObserveElementRect.Provider
      value={(_, cb) => {
        cb({ height: 200, width: 200 });
      }}
    >
      {children}
    </VirtualizerObserveElementRect.Provider>
  );
};

export const useObserveElementRect = () => {
  return useContext(VirtualizerObserveElementRect);
};
