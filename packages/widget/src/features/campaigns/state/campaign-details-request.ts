import * as Atom from "effect/reactivity/Atom";

import type { YieldId } from "../../../domain/identity/identifiers";

/**
 * The latest ask to show a yield's campaign details, numbered so asking again
 * shows them again.
 */
export type CampaignDetailsRequest = {
  readonly yieldId: YieldId;
  readonly count: number;
};

/** Lives while a Campaign section listens; a section starts from no ask. */
export const campaignDetailsRequestAtom =
  Atom.make<CampaignDetailsRequest | null>(null).pipe(
    Atom.withLabel("campaignDetailsRequestAtom")
  );

/**
 * Asks the yield's Campaign section to open and come into view, from its
 * strip or its rate's tip.
 */
export const requestCampaignDetailsAtom = Atom.fnSync(
  (yieldId: YieldId, context) =>
    context.set(campaignDetailsRequestAtom, {
      yieldId,
      count: (context(campaignDetailsRequestAtom)?.count ?? 0) + 1,
    })
).pipe(Atom.withLabel("requestCampaignDetailsAtom"));
