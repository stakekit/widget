import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";
import {
  KycStatus,
  RewardRateHistoryResponse,
  TvlHistoryResponse,
  YieldRewardsSummary,
} from "../../../src/domain/portfolio/models";

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
      expect(DateTime.isDateTime(tvl.items[0]?.timestamp)).toBe(true);
    })
  );

  it("decodes signed reward windows exactly in token units", () => {
    const window = (amount: string) => ({ amount, amountRaw: "0" });
    const input = {
      yieldId: "ethereum-eth-native-staking",
      address: "0xabc",
      token,
      last24H: window("0.000000000000000001"),
      last7D: window("-0.25"),
      last30D: window("3"),
      lastYear: window("12"),
      total: window("20.123456789012345678"),
    };
    const summary = Schema.decodeSync(YieldRewardsSummary)(input);

    expect(summary.last24H.amount.toFixed()).toBe("0.000000000000000001");
    expect(summary.last7D.amount.toFixed()).toBe("-0.25");
    expect(summary.total.amount.toFixed()).toBe("20.123456789012345678");
    expect(summary.token).toEqual({
      decimals: 18,
      network: "ethereum",
      symbol: "ETH",
    });
    expect(() =>
      Schema.decodeSync(YieldRewardsSummary)({
        ...input,
        last7D: window("not-a-number"),
      })
    ).toThrow();
  });
});
