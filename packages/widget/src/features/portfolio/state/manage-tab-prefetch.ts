import * as Atom from "effect/reactivity/Atom";
import {
  currentGroupedPositionsAtom,
  positionsTableDataAtom,
} from "./read-models/positions";
import { manageSummaryAtom } from "./read-models/summary";

/**
 * Keeps Manage tab list/summary resources subscribed while mounted so navigating
 * to Manage can paint from cache.
 */
export const manageTabResourcesPrefetchAtom = Atom.make((get) => {
  get(positionsTableDataAtom);
  get(currentGroupedPositionsAtom);
  get(manageSummaryAtom);
}).pipe(Atom.withLabel("manageTabResourcesPrefetchAtom"));
