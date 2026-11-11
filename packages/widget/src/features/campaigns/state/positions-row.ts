import * as Atom from "effect/reactivity/Atom";

import type { YieldId } from "../../../domain/identity/identifiers";
import { walletScopeAtom } from "../../wallet/index";
import type { PositionCampaignRow } from "../model/campaign-rewards-view";
import { readYieldCampaignRewards } from "./position-rewards";
import { yieldCampaignAtom } from "./yield-campaign";

/**
 * A yield's Campaign on the connected wallet's positions row: the wallet's
 * rewards there, and the campaign the yield runs. One rewards read serves
 * every row; while it loads or fails, a running campaign still shows.
 */
export const positionCampaignRowAtom = Atom.family((yieldId: YieldId) =>
  Atom.make((get): PositionCampaignRow | null => {
    const scope = get(walletScopeAtom);
    const rewarded = scope
      ? readYieldCampaignRewards(get, scope, yieldId).rewarded
      : null;
    const campaign = get(yieldCampaignAtom(yieldId));

    return rewarded || campaign
      ? {
          lifecycle: campaign?.lifecycle ?? null,
          rewards: rewarded
            ? { rewards: rewarded.rewards, stage: rewarded.stage }
            : null,
        }
      : null;
  }).pipe(Atom.withLabel("positionCampaignRowAtom"))
);
