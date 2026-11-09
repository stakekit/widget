import * as Atom from "effect/reactivity/Atom";

import type { YieldId } from "../../../../domain/identity/identifiers";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../../resources/yield-opportunity/provider";
import { toPresentable } from "../../../../shared/effect/async-result";

/** A position row's Yield, as the row presents it. */
export const positionYieldAtom = Atom.family((yieldId: YieldId) =>
  yieldOpportunityAtom
    .foreground(new YieldOpportunityKey({ yieldId }))
    .pipe(Atom.map(toPresentable), Atom.withLabel("positionYieldAtom"))
);
