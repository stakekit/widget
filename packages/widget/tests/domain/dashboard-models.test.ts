import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  KycStatus,
  RewardRateHistoryResponse,
  RewardsSummaryRecord,
  TvlHistoryResponse,
} from "../../src/domain/schema/dashboard-models";

const envelope = {
  from: "2026-06-01T00:00:00.000Z",
  interval: "day",
  limit: 2,
  offset: 0,
  to: "2026-07-01T00:00:00.000Z",
  total: 2,
  yieldId: "ethereum-eth-native-staking",
} as const;

const token = {
  decimals: 18,
  name: "Ethereum",
  network: "ethereum",
  symbol: "ETH",
} as const;

describe("dashboard application schemas", () => {
  it("strictly validates KYC singles", () => {
    expect(
      Schema.decodeUnknownSync(KycStatus)({ kycStatus: "approved" })
    ).toEqual({ kycStatus: "approved" });
    expect(() =>
      Schema.decodeUnknownSync(KycStatus)({ kycStatus: "unknown" })
    ).toThrow();
  });

  it("omits malformed reward-rate and TVL points independently", async () => {
    const rewardRate = await Effect.runPromise(
      Schema.decodeUnknownEffect(RewardRateHistoryResponse)({
        ...envelope,
        items: [
          { timestamp: "2026-06-01T00:00:00.000Z", rewardRate: "0.05" },
          { timestamp: "invalid", rewardRate: "0.07" },
        ],
      })
    );
    const tvl = await Effect.runPromise(
      Schema.decodeUnknownEffect(TvlHistoryResponse)({
        ...envelope,
        items: [
          { timestamp: "2026-06-01T00:00:00.000Z", tvlUsd: "1000.5" },
          { timestamp: "2026-06-02T00:00:00.000Z", tvlUsd: null },
        ],
      })
    );

    expect(rewardRate.items).toHaveLength(1);
    expect(rewardRate.items[0]?.value).toBe(5);
    expect(tvl.items).toHaveLength(1);
    expect(tvl.items[0]?.value).toBe(1000.5);
  });

  it("omits a malformed reward summary while retaining valid siblings", async () => {
    const rewards = {
      last24H: "0",
      last30D: "3",
      last7D: "1",
      lastYear: "12",
      total: "20",
    };
    const decoded = await Effect.runPromise(
      Schema.decodeUnknownEffect(RewardsSummaryRecord)({
        "ethereum-eth-native-staking": { rewards, token },
        "cosmos-atom-native-staking": {
          rewards,
          token: { ...token, decimals: "invalid" },
        },
      })
    );

    expect(Object.keys(decoded)).toEqual(["ethereum-eth-native-staking"]);
  });
});
