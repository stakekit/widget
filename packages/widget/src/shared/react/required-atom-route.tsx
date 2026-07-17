import { useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { createContext, type ReactNode, useContext } from "react";
import { Navigate, Outlet } from "react-router";

export const makeRequiredAtomRoute = <A,>(
  atom: Atom.Atom<A | null>,
  name: string
) => {
  const Context = createContext<A | null>(null);
  Context.displayName = `${name}Context`;

  const Provider = ({
    children,
    value,
  }: {
    readonly children: ReactNode;
    readonly value: A;
  }) => <Context.Provider value={value}>{children}</Context.Provider>;
  Provider.displayName = `${name}Provider`;

  const RouteGuard = () => {
    const value = useAtomValue(atom);

    if (value === null) {
      return <Navigate to="/" replace />;
    }

    return (
      <Provider value={value}>
        <Outlet />
      </Provider>
    );
  };
  RouteGuard.displayName = `${name}RouteGuard`;

  const useRequiredValue = (): A => {
    const value = useContext(Context);

    if (value === null) {
      throw new Error(`${name} used outside its route guard.`);
    }

    return value;
  };

  return { Provider, RouteGuard, useRequiredValue } as const;
};
