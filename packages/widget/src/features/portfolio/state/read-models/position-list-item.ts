import * as Atom from "effect/reactivity/Atom";
import type { YieldId } from "../../../../domain/identity/identifiers";
import {
  type PricesKey,
  pricesAtom,
} from "../../../../resources/token-prices/index";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../../resources/yield-opportunity/index";
import { toPresentable } from "../../../../shared/effect/async-result";

/** A position row's Yield, as the row presents it. */
export const positionYieldAtom = Atom.family((yieldId: YieldId) =>
  yieldOpportunityAtom
    .foreground(new YieldOpportunityKey({ yieldId }))
    .pipe(Atom.map(toPresentable), Atom.withLabel("positionYieldAtom"))
);

/** Token prices for a position row's amounts, as the row presents them. */
export const positionPricesAtom = Atom.family((key: PricesKey) =>
  pricesAtom
    .foreground(key)
    .pipe(Atom.map(toPresentable), Atom.withLabel("positionPricesAtom"))
);
