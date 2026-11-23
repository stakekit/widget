import * as Atom from "effect/reactivity/Atom";

import {
  getWalletCampaignStanding,
  type WalletCampaignStanding,
} from "../../../domain/earn/campaign-rewards";
import { exactZero } from "../../../domain/finance/exact";
import type { YieldId } from "../../../domain/identity/identifiers";
import { walletCampaignRewardsResourceAtom } from "../../../resources/campaign-rewards/campaign-rewards";
import { toPresentable } from "../../../shared/effect/async-result";
import { walletScopeAtom } from "../../wallet/index";
import { yieldCampaignAtom } from "./yield-campaign";

/**
 * What the connected wallet counts toward the Campaign a yield shows, from
 * the one rewards read every position shares. Without a wallet it counts
 * nothing; while the rewards load or fail, it is unknown.
 */
export const yieldCampaignStandingAtom = Atom.family((yieldId: YieldId) =>
  Atom.make((get): WalletCampaignStanding => {
    const shown = get(yieldCampaignAtom(yieldId));
    const scope = get(walletScopeAtom);
    if (!shown || !scope) {
      return { _tag: "Counted", qualifyingBalance: exactZero() };
    }

    const result = toPresentable(
      get(walletCampaignRewardsResourceAtom.local(scope))
    );
    if (result._tag !== "Ready") return { _tag: "Unknown" };

    return getWalletCampaignStanding(
      result.value.items.find(
        (rewards) => rewards.campaignId === shown.campaign.id
      ) ?? null
    );
  }).pipe(Atom.withLabel("yieldCampaignStandingAtom"))
);
