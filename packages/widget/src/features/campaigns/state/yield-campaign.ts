import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import {
  getDisplayedCampaign,
  type YieldCampaign,
} from "../../../domain/earn/campaign";
import type { YieldId } from "../../../domain/identity/identifiers";
import { projectCampaignsResourceAtom } from "../../../resources/project-campaigns/project-campaigns";
import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import type { YieldCampaignView } from "../model/yield-campaign-view";

/**
 * The project's campaigns by yield; none while they load or after they
 * failed. Campaigns enrich a yield, so they never block Earn.
 */
export const campaignsByYieldAtom = Atom.make(
  (get): ReadonlyMap<YieldId, ReadonlyArray<YieldCampaign>> =>
    get(projectCampaignsResourceAtom.foreground).pipe(
      AsyncResult.value,
      Option.getOrElse((): ReadonlyArray<YieldCampaign> => []),
      (campaigns) => Map.groupBy(campaigns, (campaign) => campaign.yieldId)
    )
).pipe(Atom.withLabel("campaignsByYieldAtom"));

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
