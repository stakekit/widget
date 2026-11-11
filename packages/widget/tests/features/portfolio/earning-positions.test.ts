import { Schema, Struct } from "effect";
import { describe, expect, it } from "vitest";

import { EarnBalance, EarnPosition } from "../../../src/domain/earn/balance";
import {
  getEarningPositionBalances,
  toPositionsData,
} from "../../../src/domain/portfolio/positions";
import { toPositionItems } from "../../../src/features/portfolio/model/positions";
import {
  getPositionsAverageApy,
  getPositionsTotal,
} from "../../../src/features/portfolio/state/read-models/summary";
import {
  yieldApiYieldFixture,
  yieldBalanceFixture,
  yieldRewardRateFixture,
} from "../../fixtures";

const yieldDto = yieldApiYieldFixture({
  rewardRate: yieldRewardRateFixture({ total: 0.05 }),
});
const position = (isEarning: boolean, amount: string) =>
  Schema.decodeSync(EarnPosition)({
    yieldId: yieldDto.id,
    balances: [
      yieldBalanceFixture({
        type: isEarning ? "active" : "exiting",
        amount,
        amountUsd: amount,
        isEarning,
        token: yieldDto.token,
      }),
    ],
  });

describe("earning position amounts", () => {
  it("keeps a non-earning position in total value but out of average APY", () => {
    const items = toPositionItems(
      toPositionsData([position(false, "900")]),
      false
    );
    const yields = new Map([[yieldDto.id, yieldDto]]);
    expect(getPositionsTotal(items, yields).toFixed()).toBe("900");
    expect(getPositionsAverageApy(items, yields).toFixed()).toBe("0");
  });

  it("weighs only the earning funds of a mixed position", () => {
    const active = position(true, "100");
    const exiting = position(false, "900");
    const otherYield = yieldApiYieldFixture({
      id: "ethereum-other-vault",
      rewardRate: yieldRewardRateFixture({ total: 0.1 }),
      token: yieldDto.token,
    });
    const items = toPositionItems(
      toPositionsData([
        {
          ...active,
          balances: [...active.balances, ...exiting.balances],
        },
        { ...active, yieldId: otherYield.id },
      ]),
      false
    );
    const yields = new Map([
      [yieldDto.id, yieldDto],
      [otherYield.id, otherYield],
    ]);
    expect(getPositionsTotal(items, yields).toFixed()).toBe("1100");
    expect(getPositionsAverageApy(items, yields).toFixed()).toBe("7.5");
  });

  it("tells which Manage rows hold earning funds, the rows that show a rate", () => {
    const earningYieldId = yieldApiYieldFixture({ id: "ethereum-earning" }).id;
    const items = toPositionItems(
      toPositionsData([
        { ...position(true, "100"), yieldId: earningYieldId },
        position(false, "900"),
      ]),
      false
    );

    expect(
      Object.fromEntries(
        items.map((item) => [item.integrationId, item.hasEarningBalances])
      )
    ).toEqual({ [earningYieldId]: true, [yieldDto.id]: false });
  });

  it.each([undefined, null, "unknown"])(
    "preserves usable balances when the optional flag is %s",
    (isEarning) => {
      const balance = Schema.decodeSync(EarnBalance)({
        ...Struct.omit(yieldBalanceFixture({ amount: "1" }), ["isEarning"]),
        ...(isEarning === undefined ? {} : { isEarning }),
      });
      expect(getEarningPositionBalances([balance])).toEqual([balance]);
    }
  );

  it("does not count a zero balance as earning", () => {
    const balance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({ amount: "0", isEarning: true })
    );
    expect(getEarningPositionBalances([balance])).toEqual([]);
  });
});
