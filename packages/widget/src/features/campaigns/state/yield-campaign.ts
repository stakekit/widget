import * as Atom from "effect/reactivity/Atom";

import { getDisplayedCampaign } from "../../../domain/earn/campaign";
import type { YieldId } from "../../../domain/identity/identifiers";
import {
  loadedCampaignsByYieldAtom,
  projectCampaignsResourceAtom,
} from "../../../resources/project-campaigns/project-campaigns";
import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import type { YieldCampaignView } from "../model/yield-campaign-view";

/**
 * The project's campaigns by yield; none while they load or after they
 * failed. Campaigns enrich a yield, so they never block Earn.
 */
export const campaignsByYieldAtom = Atom.make((get) => {
  // Read in the foreground, so a failure to load them is presented.
  get(projectCampaignsResourceAtom.foreground);
  return get(loadedCampaignsByYieldAtom);
}).pipe(Atom.withLabel("campaignsByYieldAtom"));

/** The campaign a yield shows, or null. */
export const yieldCampaignAtom = Atom.family((yieldId: YieldId) =>
  Atom.make((get): YieldCampaignView | null => {
    const clock = get(presentationClockAtom);
    if (!clock) return null;

    const displayed = getDisplayedCampaign(
      get(campaignsByYieldAtom).get(yieldId) ?? [],
      clock.now
    );

    return displayed
      ? { ...displayed, now: clock.now, timeZone: clock.timeZone }
      : null;
  }).pipe(Atom.withLabel("yieldCampaignAtom"))
);
