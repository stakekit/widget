import {
  type Dispatch,
  type PropsWithChildren,
  type ReactNode,
  type SetStateAction,
  createContext,
  useContext,
  useState,
} from "react";
import { Box } from "../../atoms/box";

type State = "full" | "short";

type RootProps = {
  init?: State;
};

const Context = createContext<
  [State, Dispatch<SetStateAction<State>>] | undefined
>(undefined);

const Root = ({ children, init }: PropsWithChildren<RootProps>) => (
  <Context.Provider value={useState(init ?? "short")}>
    {children}
  </Context.Provider>
);

type AmountProps =
  | {
      fullAmount: string;
      shortAmount: string;
      children?: never;
    }
  | {
      fullAmount?: never;
      shortAmount?: never;
      children: (props: { state: State }) => ReactNode;
    };

const useAmountContext = () => {
  const ctx = useContext(Context);

  if (!ctx) {
    throw new Error("useAmountContext must be used within a Root");
  }

  return ctx;
};

const Amount = ({ fullAmount, shortAmount, children }: AmountProps) => {
  const [state, setState] = useAmountContext();

  const toggle = () => setState(state === "full" ? "short" : "full");

  return (
    <Box as="button" onClick={toggle}>
      {children?.({ state }) ?? (state === "full" ? fullAmount : shortAmount)}
    </Box>
  );
};

export { Root, Amount };
