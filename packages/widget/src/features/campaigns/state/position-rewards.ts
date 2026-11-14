import { Data, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";

import {
  getCampaignRewardsStage,
  getYieldCampaignRewards,
} from "../../../domain/earn/campaign-rewards";
import type { YieldId } from "../../../domain/identity/identifiers";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import { walletCampaignRewardsResourceAtom } from "../../../resources/campaign-rewards/campaign-rewards";
import { toPresentable } from "../../../shared/effect/async-result";
import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import type { PositionCampaignRewardsView } from "../model/campaign-rewards-view";
import { campaignsByYieldAtom, yieldCampaignAtom } from "./yield-campaign";

export class PositionCampaignRewardsKey extends Data.TaggedClass(
  "PositionCampaignRewardsKey"
)<{
  readonly scope: WalletScopeKey;
  readonly yieldId: YieldId;
}> {}

/**
 * The wallet's rewards in a yield's Campaign, from the one rewards read every
 * position shares, with where they stand and the catalogue campaign they
 * belong to, when the catalogue lists it.
 */
export const readYieldCampaignRewards = (
  get: Atom.AtomContext,
  scope: WalletScopeKey,
  yieldId: YieldId
) => {
  const result = toPresentable(
    get(walletCampaignRewardsResourceAtom.local(scope))
  );
  const clock = get(presentationClockAtom);
  const rewards =
    result._tag === "Ready"
      ? getYieldCampaignRewards(result.value.items, yieldId)
      : null;
  if (!rewards || !clock) return { result, clock, rewarded: null };

  const campaign =
    get(campaignsByYieldAtom)
      .get(yieldId)
      ?.find(({ id }) => id === rewards.campaignId) ?? null;
  const stage = getCampaignRewardsStage(rewards, {
    endTime: campaign?.endTime ?? null,
    now: clock.now,
  });
  return { result, clock, rewarded: { campaign, rewards, stage } };
};

/**
 * A position's rewards in its yield's Campaign, for Position Details; null
 * when the wallet has none there. While they load or fail, the section shows
 * only for a yield that runs a campaign, since the wallet may have none.
 */
export const positionCampaignRewardsAtom = Atom.family(
  (key: PositionCampaignRewardsKey) =>
    Atom.make((get): PositionCampaignRewardsView | null => {
      const { result, clock, rewarded } = readYieldCampaignRewards(
        get,
        key.scope,
        key.yieldId
      );

      if (result._tag !== "Ready") {
        if (!get(yieldCampaignAtom(key.yieldId))) return null;
        return { _tag: result._tag === "Loading" ? "Loading" : "Unavailable" };
      }
      if (!rewarded || !clock) return null;

      return {
        _tag: "Ready",
        ...rewarded,
        stale: Option.isSome(result.refreshFailure),
        timeZone: clock.timeZone,
      };
    }).pipe(Atom.withLabel("positionCampaignRewardsAtom"))
);

/**
 * Whether the wallet can earn its position's Campaign: false only when the
 * backend says it is below the minimum or excluded, so the yield's "up to"
 * campaign rate doesn't read as the wallet's.
 */
export const positionCanEarnCampaignAtom = Atom.family(
  (key: PositionCampaignRewardsKey) =>
    Atom.make((get): boolean => {
      const status = readYieldCampaignRewards(get, key.scope, key.yieldId)
        .rewarded?.rewards.qualification?.status;
      return status !== "not_eligible" && status !== "below_threshold";
    }).pipe(Atom.withLabel("positionCanEarnCampaignAtom"))
);

/** Reloads the wallet's Campaign rewards after they failed to load. */
export const retryPositionCampaignRewardsAtom = Atom.family(
  (scope: WalletScopeKey) =>
    Atom.fnSync(
      (_input: undefined, context) =>
        context.refresh(walletCampaignRewardsResourceAtom.local(scope)),
      { initialValue: undefined }
    )
);
