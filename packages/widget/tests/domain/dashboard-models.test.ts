import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";
import {
  KycStatus,
  RewardRateHistoryResponse,
  RewardsSummaryRecord,
  TvlHistoryResponse,
} from "../../src/domain/portfolio/models";

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
    expect(Schema.decodeSync(KycStatus)({ kycStatus: "approved" })).toEqual({
      kycStatus: "approved",
    });
    expect(() =>
      Schema.decodeUnknownSync(KycStatus)({ kycStatus: "unknown" })
    ).toThrow();
  });

  it.effect("omits malformed reward-rate and TVL points independently", () =>
    Effect.gen(function* () {
      const rewardRate = yield* Schema.decodeEffect(RewardRateHistoryResponse)({
        ...envelope,
        items: [
          { timestamp: "2026-06-01T00:00:00.000Z", rewardRate: "0.05" },
          { timestamp: "invalid", rewardRate: "0.07" },
        ],
      });
      const tvl = yield* Schema.decodeEffect(TvlHistoryResponse)({
        ...envelope,
        items: [
          {
            timestamp: "2026-06-01T00:00:00.000Z",
            tvl: "1000.5",
            tvlRaw: "1000500000",
          },
          {
            timestamp: "2026-06-02T00:00:00.000Z",
            tvl: null,
            tvlRaw: "0",
          },
        ],
      });

      expect(rewardRate.items).toHaveLength(1);
      expect(rewardRate.items[0]?.rewardRate.toFixed()).toBe("0.05");
      expect(DateTime.isDateTime(rewardRate.from)).toBe(true);
      expect(DateTime.isDateTime(rewardRate.to)).toBe(true);
      expect(DateTime.isDateTime(rewardRate.items[0]?.timestamp)).toBe(true);
      expect(tvl.items).toHaveLength(1);
      expect(tvl.items[0]?.tvl.toFixed()).toBe("1000.5");
      expect(tvl.items[0]?.tvlRaw).toBe("1000500000");
      expect(DateTime.isDateTime(tvl.items[0]?.timestamp)).toBe(true);
    })
  );

  it.effect(
    "omits a malformed reward summary while retaining valid siblings",
    () =>
      Effect.gen(function* () {
        const rewards = {
          last24H: "0",
          last30D: "3",
          last7D: "1",
          lastYear: "12",
          total: "20",
        };
        const decoded = yield* Schema.decodeEffect(RewardsSummaryRecord)({
          "ethereum-eth-native-staking": { rewards, token },
          "cosmos-atom-native-staking": {
            rewards,
            token: { ...token, decimals: "invalid" },
          },
        });

        expect(Object.keys(decoded)).toEqual(["ethereum-eth-native-staking"]);
      })
  );
});
