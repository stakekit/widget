import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

import {
  CampaignPayoutPage,
  WalletCampaignRewardsPage,
} from "../../../src/domain/earn/campaign-rewards";
import {
  CampaignId,
  WalletAddress,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  CampaignPayoutsKey,
  campaignPayoutsResourceAtom,
  walletCampaignRewardsResourceAtom,
} from "../../../src/resources/campaign-rewards/campaign-rewards";
import { appRuntime } from "../../../src/runtime/app-runtime";
import type { YieldResourceSource } from "../../../src/services/api/resource-sources";
import {
  yieldApiCampaignPayoutDtoFixture,
  yieldApiCampaignRewardsDtoFixture,
} from "../../fixtures";
import { yieldResourceSourceLayer } from "../../utils/services/resource-sources";

const checksumAddress = Schema.decodeSync(WalletAddress)(
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
);
const campaignId = Schema.decodeSync(CampaignId)(
  "8f4f5c3a-1d2b-4c3e-9f00-2a7b6c5d4e01"
);
const scope = (address: WalletAddress) =>
  new WalletScopeKey({ address, network: "ethereum" });

const rewardsPage = Schema.decodeSync(WalletCampaignRewardsPage)({
  items: [yieldApiCampaignRewardsDtoFixture()],
});
const payoutsPage = (offset: number) =>
  Schema.decodeSync(CampaignPayoutPage)({
    items: [yieldApiCampaignPayoutDtoFixture()],
    limit: 20,
    offset,
    total: 45,
  });

const makeRegistry = (source: Partial<YieldResourceSource["Service"]>) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(appRuntime.layer, yieldResourceSourceLayer(source)),
    ],
  });

describe("Campaign rewards resources", () => {
  it("reads a wallet's rewards across every campaign in one request per owner", () => {
    const listWalletCampaignRewards = vi.fn(() => Effect.succeed(rewardsPage));
    const registry = makeRegistry({ listWalletCampaignRewards });

    const first = walletCampaignRewardsResourceAtom(scope(checksumAddress));
    const second = walletCampaignRewardsResourceAtom(
      scope(WalletAddress.make(checksumAddress.toLowerCase()))
    );

    expect(second).toBe(first);
    expect(AsyncResult.getOrThrow(registry.get(first)).items).toHaveLength(1);
    registry.get(second);
    expect(listWalletCampaignRewards).toHaveBeenCalledOnce();
    expect(listWalletCampaignRewards).toHaveBeenCalledWith({
      address: checksumAddress.toLowerCase(),
    });
  });

  it("keeps earlier payouts pages when showing more, and knows when there are none left", () => {
    const listCampaignPayouts = vi.fn((request: { readonly offset: number }) =>
      Effect.succeed(payoutsPage(request.offset))
    );
    const registry = makeRegistry({ listCampaignPayouts });
    const payouts = (pages: number) =>
      registry.get(
        campaignPayoutsResourceAtom(
          new CampaignPayoutsKey({
            campaignId,
            pages,
            scope: scope(checksumAddress),
          })
        )
      );

    expect(payouts(1)).toMatchObject({ hasMore: true, total: 45 });
    expect(payouts(2).items).toHaveLength(2);
    // 45 payouts in pages of 20: the third page is the last.
    expect(payouts(3)).toMatchObject({ hasMore: false, loading: false });

    expect(listCampaignPayouts.mock.calls.map(([request]) => request)).toEqual(
      [0, 20, 40].map((offset) => ({
        address: checksumAddress.toLowerCase(),
        campaignId,
        limit: 20,
        offset,
      }))
    );
  });
});
