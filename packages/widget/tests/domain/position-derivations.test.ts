import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { EarnPosition } from "../../src/domain/schema/earn-models";
import {
  getPositionBalances,
  getPositionData,
  toPositionBalancesByType,
  toPositionsData,
} from "../../src/domain/types/positions";
import {
  PositionDataKey,
  positionDataAtom,
  toPositionItems,
} from "../../src/features/portfolio";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../fixtures";

const makePosition = () => {
  const yieldDto = yieldApiYieldFixture();

  return Schema.decodeUnknownSync(EarnPosition)({
    balances: [
      yieldBalanceFixture({
        amount: "2",
        amountUsd: "5",
        type: "active",
        token: yieldDto.token,
      }),
      yieldBalanceFixture({
        amount: "0",
        amountUsd: "0",
        type: "claimable",
        token: yieldDto.token,
      }),
    ],
    outputTokenBalance: null,
    yieldId: yieldDto.id,
  });
};

describe("position derivations", () => {
  it("normalizes positions and selects a requested or fallback balance group", () => {
    const position = makePosition();
    const positions = toPositionsData([position]);
    const selected = getPositionData(positions, position.yieldId);
    const balances = getPositionBalances(selected, "missing-balance-group");

    expect(selected?.yieldId).toBe(position.yieldId);
    expect(balances?.balances).toHaveLength(2);
    expect(balances?.type).toBe("default");
  });

  it("groups non-zero balances and projects visible table rows", () => {
    const position = makePosition();
    const positions = toPositionsData([position]);
    const selected = getPositionBalances(
      getPositionData(positions, position.yieldId),
      "default"
    );
    const byType = toPositionBalancesByType(selected?.balances ?? []);
    const rows = toPositionItems(positions, false);

    expect(byType.get("active")?.[0]?.tokenPriceInUsd.toFixed()).toBe("5");
    expect(byType.has("claimable")).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.balancesWithAmount).toHaveLength(1);
  });

  it("deduplicates derived atom families by value-equal domain keys", () => {
    const { yieldId } = makePosition();

    expect(positionDataAtom(new PositionDataKey({ yieldId }))).toBe(
      positionDataAtom(new PositionDataKey({ yieldId }))
    );
  });
});
