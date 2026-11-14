import type BigNumber from "bignumber.js";
import { DateTime, Schema, SchemaGetter, Struct } from "effect";

import * as YieldApi from "../../generated/api/yield-schema";
import { TolerantArray, TolerantNullOr } from "../decoding/response-schema";
import { exactZero } from "../finance/exact";
import {
  NonNegativeExactDecimal,
  TolerantNullableUtcDateTimeFromString,
} from "../finance/scalars";
import { CampaignId, TransactionHash, YieldId } from "../identity/identifiers";
import { Token } from "../token/token";
import type { EarnBalance } from "./balance";

const rewardsOperation = "campaign-rewards";
const payoutsOperation = "campaign-payouts";

const CampaignRewardTotals = Schema.Struct({
  earned: NonNegativeExactDecimal,
  paid: NonNegativeExactDecimal,
  unpaid: NonNegativeExactDecimal,
});

const CampaignQualification = Schema.Struct({
  status: Schema.Literals(["qualified", "below_threshold", "not_eligible"]),
  qualifyingBalance: NonNegativeExactDecimal,
  incentivizedBalance: NonNegativeExactDecimal,
});

/**
 * What one wallet has earned in one Campaign: totals over the whole campaign
 * in the reward token, and, for compound campaigns, in the yield's token.
 * Earned is paid plus unpaid; unpaid is the backend's estimate.
 */
export const WalletCampaignRewards = Schema.Struct({
  campaignId: CampaignId,
  yieldId: YieldId,
  status: Schema.Literals(["active", "paused", "ended"]),
  rewardMode: TolerantNullOr(Schema.Literals(["normal", "compound"]), {
    operation: rewardsOperation,
    field: "rewardMode",
  }),
  rewardToken: Token,
  totals: CampaignRewardTotals,
  inputTokenTotals: TolerantNullOr(CampaignRewardTotals, {
    operation: rewardsOperation,
    field: "inputTokenTotals",
  }),
  accruedThrough: TolerantNullableUtcDateTimeFromString({
    operation: rewardsOperation,
    field: "accruedThrough",
  }),
  nextPayoutDueAt: TolerantNullableUtcDateTimeFromString({
    operation: rewardsOperation,
    field: "nextPayoutDueAt",
  }),
  qualification: TolerantNullOr(CampaignQualification, {
    operation: rewardsOperation,
    field: "qualification",
  }),
});
export type WalletCampaignRewards = typeof WalletCampaignRewards.Type;

const CampaignRewardsIdentifier = Schema.Struct({
  campaignId: CampaignId,
}).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.campaignId),
    encode: SchemaGetter.forbidden(
      () => "Campaign rewards identifier is decode-only"
    ),
  })
);

export const WalletCampaignRewardsPage = Schema.Struct({
  items: TolerantArray(WalletCampaignRewards, {
    operation: rewardsOperation,
    identifier: CampaignRewardsIdentifier,
  }),
});

/** One payout of a wallet's Campaign rewards; pending until it executes. */
export const CampaignPayout = Schema.Struct({
  paidAt: TolerantNullableUtcDateTimeFromString({
    operation: payoutsOperation,
    field: "paidAt",
  }),
  amount: NonNegativeExactDecimal,
  inputTokenAmount: TolerantNullOr(NonNegativeExactDecimal, {
    operation: payoutsOperation,
    field: "inputTokenAmount",
  }),
  txHash: TolerantNullOr(TransactionHash, {
    operation: payoutsOperation,
    field: "txHash",
  }),
  status: Schema.Literals(["pending", "paid"]),
});
export type CampaignPayout = typeof CampaignPayout.Type;

export const CampaignPayoutPage = Schema.Struct({
  // Pagination reads these to request the remaining pages.
  ...Struct.pick(YieldApi.CampaignsControllerGetCampaignPayouts200.fields, [
    "total",
    "offset",
    "limit",
  ]),
  items: Schema.optionalKey(
    TolerantArray(CampaignPayout, { operation: payoutsOperation })
  ),
});
export type CampaignPayoutPage = typeof CampaignPayoutPage.Type;

/**
 * The totals as the position holds them: in the yield's token when the
 * backend values them so (compound campaigns), in the reward token otherwise.
 */
export const getCampaignRewardsAmounts = (
  rewards: WalletCampaignRewards,
  yieldToken: Token
) =>
  rewards.inputTokenTotals
    ? { token: yieldToken, ...rewards.inputTokenTotals }
    : { token: rewards.rewardToken, ...rewards.totals };

/** A payout in the same token as `getCampaignRewardsAmounts` shows. */
export const getCampaignPayoutAmount = (
  payout: CampaignPayout,
  rewards: WalletCampaignRewards,
  yieldToken: Token
) =>
  rewards.inputTokenTotals && payout.inputTokenAmount
    ? { token: yieldToken, amount: payout.inputTokenAmount }
    : { token: rewards.rewardToken, amount: payout.amount };

export type CampaignQualificationState =
  | { readonly _tag: "Earning" }
  | {
      readonly _tag: "OverCap";
      /** The part of the balance that earns campaign rewards. */
      readonly cap: BigNumber;
      /** The part over the cap, which earns only the yield's own rate. */
      readonly uncapped: BigNumber;
    }
  | {
      readonly _tag: "BelowMinimum";
      /** The campaign's minimum balance, when known. */
      readonly minimum: BigNumber | null;
      readonly shortfall: BigNumber | null;
    }
  | { readonly _tag: "NotEligible" }
  | { readonly _tag: "Unknown" };

/**
 * Why the wallet does or doesn't earn, from the balance the backend counts.
 * Over the cap is no status of its own: it shows as an incentivized balance
 * below the qualifying one. `minimum` comes from the campaign, so a
 * campaign the widget can't read leaves the shortfall unknown.
 */
export const getCampaignQualificationState = (
  rewards: WalletCampaignRewards,
  minimum: BigNumber | null
): CampaignQualificationState => {
  const { qualification } = rewards;
  if (!qualification) return { _tag: "Unknown" };

  switch (qualification.status) {
    case "not_eligible":
      return { _tag: "NotEligible" };
    case "below_threshold": {
      const shortfall = minimum?.minus(qualification.qualifyingBalance);
      return {
        _tag: "BelowMinimum",
        minimum,
        shortfall: shortfall?.isNegative() ? exactZero() : (shortfall ?? null),
      };
    }
    case "qualified":
      return qualification.incentivizedBalance.isLessThan(
        qualification.qualifyingBalance
      )
        ? {
            _tag: "OverCap",
            cap: qualification.incentivizedBalance,
            uncapped: qualification.qualifyingBalance.minus(
              qualification.incentivizedBalance
            ),
          }
        : { _tag: "Earning" };
  }
};

export type CampaignRewardsStage =
  | "earning"
  | "paused"
  | "final_payout_pending"
  | "paid_out";

/**
 * Where the wallet's rewards stand: building up, paused, or, once the
 * campaign has ended, waiting for the final payout until nothing is unpaid.
 * The campaign ends at its `endTime` even while the API still lists it as
 * running, as on Earn.
 */
export const getCampaignRewardsStage = (
  rewards: WalletCampaignRewards,
  campaign: {
    /** When the catalogue says the campaign ends; null when it doesn't list it. */
    readonly endTime: DateTime.Utc | null;
    readonly now: DateTime.Utc;
  }
): CampaignRewardsStage => {
  const pastEnd =
    campaign.endTime !== null &&
    !DateTime.isLessThan(campaign.now, campaign.endTime);
  if (rewards.status === "ended" || pastEnd) {
    return rewards.totals.unpaid.isGreaterThan(0)
      ? "final_payout_pending"
      : "paid_out";
  }
  return rewards.status === "paused" ? "paused" : "earning";
};

/**
 * A `locked` balance that holds a Campaign's unpaid rewards. They pay out on
 * the campaign's schedule, so the balance asks nothing of the user.
 */
export const isCampaignRewardsBalance = (
  balance: Pick<EarnBalance, "campaignId" | "type">
) => balance.type === "locked" && balance.campaignId !== undefined;

const statusPriority = { active: 0, paused: 1, ended: 2 } as const;

/**
 * The rewards a yield's position shows when the wallet earned in several of
 * its campaigns over time: the live one, else a paused one, else an ended
 * one, the first listed among equals.
 */
export const getYieldCampaignRewards = (
  items: ReadonlyArray<WalletCampaignRewards>,
  yieldId: YieldId
): WalletCampaignRewards | null =>
  items
    .filter((item) => item.yieldId === yieldId)
    .reduce<WalletCampaignRewards | null>(
      (shown, item) =>
        shown && statusPriority[shown.status] <= statusPriority[item.status]
          ? shown
          : item,
      null
    );
