import { useAtom } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";

/**
 * Set while a component animates its own height, so the surrounding animated
 * widget layout skips its transition duration instead of racing it.
 */
const disableTransitionDurationAtom = Atom.make(false);

export const useDisableTransitionDuration = () =>
  useAtom(disableTransitionDurationAtom);
