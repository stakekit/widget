import { useAtom } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useSyncElementHeight } from "../../../hooks/use-sync-element-height";

const headerHeightAtom = Atom.make(0);

export const useHeaderHeight = () => useAtom(headerHeightAtom);

export const useSyncHeaderHeight = () => {
  return useSyncElementHeight(useHeaderHeight()[1]);
};
