import { Data, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import {
  getLiveCampaignBalance,
  getWalletCampaignStanding,
  type WalletCampaignStanding,
} from "../../../domain/earn/campaign-rewards";
import type { EarnYield } from "../../../domain/earn/yield-schema";
import { exactZero } from "../../../domain/finance/exact";
import type { YieldId } from "../../../domain/identity/identifiers";
import { type TokenString, tokenString } from "../../../domain/token/token";
import { walletCampaignRewardsResourceAtom } from "../../../resources/campaign-rewards/campaign-rewards";
import { yieldPositionsResourceAtom } from "../../../resources/yield-positions/yield-positions";
import { toPresentable } from "../../../shared/effect/async-result";
import { walletScopeAtom } from "../../wallet/index";
import { yieldCampaignAtom } from "./yield-campaign";

class CampaignStandingKey extends Data.Class<{
  readonly yieldId: YieldId;
  /** The yield's token, the one its Campaign Minimum counts. */
  readonly yieldToken: TokenString;
}> {}

const campaignStandingAtom = Atom.family((key: CampaignStandingKey) =>
  Atom.make((get): WalletCampaignStanding => {
    const shown = get(yieldCampaignAtom(key.yieldId));
    const scope = get(walletScopeAtom);
    if (!shown || !scope) return { _tag: "Counted", held: exactZero() };

    const result = toPresentable(
      get(walletCampaignRewardsResourceAtom.local(scope))
    );
    if (result._tag !== "Ready") return { _tag: "Unknown" };

    // Read in the background: positions that load or fail count nothing
    // live, and the rewards still do.
    const balances =
      get(yieldPositionsResourceAtom.local(scope))
        .pipe(AsyncResult.value, Option.getOrNull)
        ?.items.find((position) => position.yieldId === key.yieldId)
        ?.balances ?? [];

    return getWalletCampaignStanding({
      liveBalance: getLiveCampaignBalance(balances, key.yieldToken),
      rewards:
        result.value.items.find(
          (rewards) => rewards.campaignId === shown.campaign.id
        ) ?? null,
    });
  }).pipe(Atom.withLabel("yieldCampaignStandingAtom"))
);

/**
 * What the connected wallet holds toward the Campaign a yield shows: the
 * higher of its Qualifying Balance, from the one rewards read every position
 * shares, and its live balance in the yield, which a recent deposit reaches
 * first. Without a wallet it holds nothing; while the rewards load or fail,
 * it is unknown.
 */
export const yieldCampaignStandingAtom = (
  yieldDto: Pick<EarnYield, "id" | "token">
) =>
  campaignStandingAtom(
    new CampaignStandingKey({
      yieldId: yieldDto.id,
      yieldToken: tokenString(yieldDto.token),
    })
  );
