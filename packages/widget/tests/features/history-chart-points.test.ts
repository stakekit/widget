import { DateTime, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { ActionCommand } from "../../src/domain/action/models";
import { exactDecimal } from "../../src/domain/finance/exact";
import { UtcDateTimeFromString } from "../../src/domain/finance/scalars";
import { WalletAddress, YieldId } from "../../src/domain/identity/identifiers";
import {
  toRewardRateHistoryChartPoint,
  toTvlHistoryChartPoint,
} from "../../src/features/earn/model/history-chart-points";

const timestamp = Schema.decodeSync(UtcDateTimeFromString)(
  "2026-06-01T00:00:00.000Z"
);

describe("history chart adapters", () => {
  it("converts exact history values to numbers only for chart points", () => {
    const tvl = exactDecimal("9007199254740993.25");
    const rewardRate = exactDecimal("0.0312");
    const tvlPoint = toTvlHistoryChartPoint({
      timestamp,
      tvl,
      tvlRaw: "9007199254740993250000000000000000",
    });
    const rewardPoint = toRewardRateHistoryChartPoint({
      timestamp,
      rewardRate,
    });
    const command = Schema.decodeSync(ActionCommand)({
      address: Schema.decodeSync(WalletAddress)(
        "0x1234567890123456789012345678901234567890"
      ),
      arguments: { amount: tvl.toFixed() },
      yieldId: Schema.decodeSync(YieldId)("ethereum-eth-native-staking"),
    });

    expect(typeof tvlPoint.value).toBe("number");
    expect(DateTime.isDateTime(tvlPoint.timestamp)).toBe(true);
    expect(rewardPoint.value).toBe(3.12);
    expect(command.arguments?.amount).toBe(tvl.toFixed());
    expect(command.arguments?.amount).not.toBe(String(tvlPoint.value));
  });
});
