import type { DateTime } from "effect";

import type {
  CampaignLifecycle,
  YieldCampaign,
} from "../../../domain/earn/campaign";
import type {
  CampaignRewardsStage,
  WalletCampaignRewards,
} from "../../../domain/earn/campaign-rewards";

/** A position's Campaign rewards once they have loaded. */
export type ReadyCampaignRewardsView = {
  readonly _tag: "Ready";
  /** The campaign as the catalogue lists it, while it runs or is paused. */
  readonly campaign: YieldCampaign | null;
  readonly rewards: WalletCampaignRewards;
  readonly stage: CampaignRewardsStage;
  /** The latest reload failed; `rewards` is the last one that loaded. */
  readonly stale: boolean;
  readonly timeZone: DateTime.TimeZone;
};

export type PositionCampaignRewardsView =
  | { readonly _tag: "Loading" }
  | { readonly _tag: "Unavailable" }
  | ReadyCampaignRewardsView;

/** A yield's Campaign on a positions row, as far as it is known. */
export type PositionCampaignRow = {
  /** Where the yield's catalogue campaign stands, if it runs one. */
  readonly lifecycle: Exclude<CampaignLifecycle, "ended"> | null;
  /** The wallet's rewards in it, and where they stand, once they have loaded. */
  readonly rewards: {
    readonly rewards: WalletCampaignRewards;
    readonly stage: CampaignRewardsStage;
  } | null;
};
