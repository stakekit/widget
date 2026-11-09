import type BigNumber from "bignumber.js";
import * as Atom from "effect/reactivity/Atom";

import type { TokenAmount } from "../../../../domain/earn/denomination";
import type { YieldId } from "../../../../domain/identity/identifiers";
import {
  getTokenSumsUsd,
  type PositionTokenSum,
} from "../../../../domain/portfolio/positions";
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

/** What a row shows of its total: its amount, and the USD value beside it. */
export type PositionTotalDisplay = Readonly<{
  /** The total in its token, when it is a single sum. */
  readonly amount: TokenAmount | null;
  /** The positive USD value, when priced. */
  readonly amountUsd: BigNumber | null;
}>;

/**
 * A single sum shows its amount beside its USD value; several sums in
 * different tokens show only their USD total.
 */
export const toPositionTotalDisplay = (
  total: ReadonlyArray<PositionTokenSum>
): PositionTotalDisplay => {
  const [single, ...others] = total;
  const amountUsd = getTokenSumsUsd(total);
  return {
    amount: single && others.length === 0 ? single : null,
    amountUsd: amountUsd.isGreaterThan(0) ? amountUsd : null,
  };
};
