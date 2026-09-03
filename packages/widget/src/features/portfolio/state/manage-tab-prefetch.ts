import * as Atom from "effect/unstable/reactivity/Atom";
import {
  currentGroupedPositionsAtom,
  currentPortfolioBorrowPositionsAtom,
  positionsTableDataAtom,
} from "./read-models/positions";
import {
  allPositionsSummaryAtom,
  availableBalanceSummaryAtom,
  averageApySummaryAtom,
} from "./read-models/summary";

/**
 * Keeps Manage tab list/summary resources subscribed while mounted so navigating
 * to Manage can paint from cache.
 */
export const manageTabResourcesPrefetchAtom = Atom.make((get) => {
  get(positionsTableDataAtom);
  get(currentGroupedPositionsAtom);
  get(currentPortfolioBorrowPositionsAtom);
  get(allPositionsSummaryAtom);
  get(availableBalanceSummaryAtom);
  get(averageApySummaryAtom);
}).pipe(Atom.withLabel("manageTabResourcesPrefetchAtom"));
