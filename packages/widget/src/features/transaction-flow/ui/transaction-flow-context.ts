import { useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/reactivity/Atom";
import { createContext, useContext } from "react";

/**
 * A value a flow route provides to the pages under it, such as its Session
 * or its Execution, and the hook those pages read it with. Only a page under
 * that route may call the hook; `name` says what it missed.
 */
export const makeTransactionFlowContext = <Value>(name: string) => {
  const context = createContext<Value | null>(null);
  const useValue = (): Value => {
    const value = useContext(context);
    if (!value) throw new Error(`${name} is unavailable.`);
    return value;
  };
  return { context, useValue } as const;
};

const nullAtom: Atom.Atom<null> = Atom.make(null);

/** The value of `family`'s Atom for `key`; null without a key. */
export const useOptionalAtomValue = <Key, Value>(
  family: (key: Key) => Atom.Atom<Value>,
  key: Key | null
): Value | null =>
  useAtomValue<Value | null>(key === null ? nullAtom : family(key));
