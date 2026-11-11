import { Data, Duration, Effect, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";

import type { CampaignPayout } from "../../domain/earn/campaign-rewards";
import type { CampaignId } from "../../domain/identity/identifiers";
import {
  type WalletScopeKey,
  WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../../domain/wallet/wallet-scope";
import { appRuntime } from "../../runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../services/api/resource-sources";
import { YieldResourceSource } from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { toPresentable } from "../../shared/effect/async-result";
import { getNextPageOffset } from "../../shared/effect/pagination";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

class CampaignRewardsError extends Data.TaggedError("CampaignRewardsError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

// The API caches a wallet's rewards for a minute and accrues them hourly.
const campaignRewardsPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(1),
});

const walletCampaignRewardsCanonicalAtom = Atom.family(
  (owner: WalletScopeOwnerKey) =>
    appRuntime
      .atom(() =>
        YieldResourceSource.use((source) =>
          source.listWalletCampaignRewards({ address: owner.address })
        ).pipe(Effect.mapError((cause) => new CampaignRewardsError({ cause })))
      )
      .pipe(
        // Deposits and withdrawals change what the wallet qualifies for.
        Atom.withReactivity(resourceInvalidationKeys.yieldPositions(owner)),
        campaignRewardsPolicy,
        Atom.withLabel("walletCampaignRewardsResourceAtom")
      )
);

const walletCampaignRewardsByOwner = makePresentableResourceFamily(
  walletCampaignRewardsCanonicalAtom
);

const foregroundWalletCampaignRewards = (scope: WalletScopeKey) =>
  walletCampaignRewardsByOwner.foreground(walletScopeOwnerKey(scope));

/**
 * A wallet's rewards in every Campaign it accrued in, one request per wallet
 * for all its positions.
 */
export const walletCampaignRewardsResourceAtom = Object.assign(
  foregroundWalletCampaignRewards,
  {
    foreground: foregroundWalletCampaignRewards,
    local: (scope: WalletScopeKey) =>
      walletCampaignRewardsByOwner.local(walletScopeOwnerKey(scope)),
  }
);

const PAYOUTS_PAGE_SIZE = 20;

/** One page of a wallet's payouts in one Campaign, counted from 0. */
class CampaignPayoutsPageKey extends Data.TaggedClass(
  "CampaignPayoutsPageKey"
)<{
  readonly campaignId: CampaignId;
  readonly owner: WalletScopeOwnerKey;
  readonly page: number;
}> {
  constructor(input: {
    readonly campaignId: CampaignId;
    readonly page: number;
    readonly scope: Pick<WalletScopeKey, "address" | "network">;
  }) {
    super({
      campaignId: input.campaignId,
      owner: walletScopeOwnerKey(input.scope),
      page: input.page,
    });
  }
}

const campaignPayoutsPageCanonicalAtom = Atom.family(
  (key: CampaignPayoutsPageKey) =>
    appRuntime
      .atom(() =>
        YieldResourceSource.use((source) =>
          source.listCampaignPayouts({
            address: key.owner.address,
            campaignId: key.campaignId,
            limit: PAYOUTS_PAGE_SIZE,
            offset: key.page * PAYOUTS_PAGE_SIZE,
          })
        ).pipe(Effect.mapError((cause) => new CampaignRewardsError({ cause })))
      )
      .pipe(
        Atom.withReactivity(resourceInvalidationKeys.yieldPositions(key.owner)),
        campaignRewardsPolicy,
        Atom.withLabel("campaignPayoutsPageResourceAtom")
      )
);

const campaignPayoutsPageResourceAtom = makePresentableResourceFamily(
  campaignPayoutsPageCanonicalAtom
);

/** The first `pages` pages of a wallet's payouts in one Campaign. */
export class CampaignPayoutsKey extends Data.TaggedClass("CampaignPayoutsKey")<{
  readonly campaignId: CampaignId;
  /** How many pages to show, at least one. */
  readonly pages: number;
  readonly scope: WalletScopeKey;
}> {}

export type CampaignPayoutsList = {
  readonly items: ReadonlyArray<CampaignPayout>;
  /** Every payout the wallet has in the campaign, pending ones included. */
  readonly total: number | null;
  /** The next page asked for is loading. */
  readonly loading: boolean;
  /** The next page asked for failed; earlier pages stay. */
  readonly failed: boolean;
  readonly hasMore: boolean;
};

const pageKeys = (key: CampaignPayoutsKey) =>
  Array.from(
    { length: Math.max(1, key.pages) },
    (_, page) =>
      new CampaignPayoutsPageKey({
        campaignId: key.campaignId,
        page,
        scope: key.scope,
      })
  );

/**
 * A wallet's payouts in a Campaign, pending ones first, then newest first,
 * up to the first page that hasn't loaded. Each page is its own read, so
 * showing more keeps the earlier pages.
 */
export const campaignPayoutsResourceAtom = Atom.family(
  (key: CampaignPayoutsKey) =>
    Atom.make((get): CampaignPayoutsList => {
      const pages = pageKeys(key).map((page) =>
        toPresentable(get(campaignPayoutsPageResourceAtom.local(page)))
      );
      const firstUnloaded = pages.findIndex((page) => page._tag !== "Ready");
      const loaded = (
        firstUnloaded === -1 ? pages : pages.slice(0, firstUnloaded)
      ).flatMap((page) => (page._tag === "Ready" ? [page.value] : []));
      const next = firstUnloaded === -1 ? null : pages[firstUnloaded];
      const last = loaded.at(-1);

      return {
        items: loaded.flatMap((page) => page.items ?? []),
        total: last?.total ?? null,
        loading: next?._tag === "Loading",
        failed: next?._tag === "Failed",
        hasMore: last ? Option.isSome(getNextPageOffset(last)) : false,
      };
    }).pipe(Atom.withLabel("campaignPayoutsResourceAtom"))
);

/** Reloads the first page of payouts that failed to load. */
export const retryCampaignPayoutsAtom = Atom.family((key: CampaignPayoutsKey) =>
  Atom.fnSync(
    (_input: undefined, context) => {
      const failed = pageKeys(key)
        .map((page) => campaignPayoutsPageResourceAtom.local(page))
        .find((page) => toPresentable(context(page))._tag === "Failed");
      if (failed) context.refresh(failed);
    },
    { initialValue: undefined }
  )
);
