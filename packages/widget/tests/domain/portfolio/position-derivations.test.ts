import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { EarnBalance, EarnPosition } from "../../../src/domain/earn/balance";
import {
  BalanceDataKey,
  getPositionBalances,
  getPositionData,
  getPositionValueTotal,
  getSingleExitTokenSum,
  groupPositionBalanceRows,
  hasActivePositionForYield,
  sumBalancesByToken,
  toPositionBalancesByType,
  toPositionsData,
} from "../../../src/domain/portfolio/positions";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../../fixtures";

const makePosition = () => {
  const yieldDto = yieldApiYieldFixture();

  return Schema.decodeSync(EarnPosition)({
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
  it("normalizes positions and selects the requested balance group", () => {
    const position = makePosition();
    const positions = toPositionsData([position]);
    const selected = getPositionData(positions, position.yieldId);
    const balances = getPositionBalances(selected, "default");

    expect(selected?.yieldId).toBe(position.yieldId);
    expect(balances?.balances).toHaveLength(2);
    expect(balances?.type).toBe("default");
  });

  it("does not substitute another balance group for an unknown balance id", () => {
    const position = makePosition();
    const positions = toPositionsData([position]);
    const selected = getPositionData(positions, position.yieldId);

    expect(
      getPositionBalances(
        selected,
        Schema.decodeSync(BalanceDataKey)("validator::missing")
      )
    ).toBeNull();
  });

  it("sums balances per token identity without merging equal symbols on different addresses", () => {
    const token = yieldApiYieldFixture().token;
    const usdcA = {
      ...token,
      address: "0x00000000000000000000000000000000000000a1",
      symbol: "USDC",
    };
    const usdcB = {
      ...token,
      address: "0x00000000000000000000000000000000000000b2",
      symbol: "USDC",
    };
    const balances = [
      yieldBalanceFixture({ amount: "1.1", amountUsd: "1.1", token: usdcA }),
      yieldBalanceFixture({ amount: "3", amountUsd: "3.2", token: usdcB }),
      yieldBalanceFixture({ amount: "2.2", amountUsd: "2.2", token: usdcA }),
    ].map((balance) => Schema.decodeSync(EarnBalance)(balance));

    const sums = sumBalancesByToken(balances);

    expect(
      sums.map((sum) => ({
        address: sum.token.address,
        amount: sum.amount.toFixed(),
        amountUsd: sum.amountUsd.toFixed(),
      }))
    ).toEqual([
      { address: usdcA.address, amount: "3.3", amountUsd: "3.3" },
      { address: usdcB.address, amount: "3", amountUsd: "3.2" },
    ]);
  });

  describe("position total", () => {
    const token = yieldApiYieldFixture().token;
    const usdc = {
      ...token,
      address: "0x00000000000000000000000000000000000000a1",
      symbol: "USDC",
    };
    const dai = {
      ...usdc,
      address: "0x00000000000000000000000000000000000000d1",
      symbol: "DAI",
    };
    const foo = {
      ...usdc,
      address: "0x00000000000000000000000000000000000000f1",
      symbol: "FOO",
    };
    const decode = (overrides: Parameters<typeof yieldBalanceFixture>[0]) =>
      Schema.decodeSync(EarnBalance)(yieldBalanceFixture(overrides));
    const summarize = (balances: ReadonlyArray<EarnBalance>) =>
      getPositionValueTotal(balances).map((sum) => ({
        amount: sum.amount.toFixed(),
        amountUsd: sum.amountUsd.toFixed(),
        symbol: sum.token.symbol,
      }));

    it("converts a priced second token into the primary Value Token", () => {
      expect(
        summarize([
          decode({ amount: "1", amountUsd: "2", token: dai, type: "entering" }),
          decode({ amount: "2", amountUsd: "2", token: usdc, type: "active" }),
        ])
      ).toEqual([{ amount: "4", amountUsd: "4", symbol: "USDC" }]);
    });

    it("keeps an unpriced second token apart instead of adding its raw amount", () => {
      expect(
        summarize([
          decode({ amount: "5", amountUsd: "5", token: usdc, type: "active" }),
          decode({
            amount: "1000",
            amountUsd: null,
            token: foo,
            type: "claimable",
          }),
        ])
      ).toEqual([
        { amount: "5", amountUsd: "5", symbol: "USDC" },
        { amount: "1000", amountUsd: "0", symbol: "FOO" },
      ]);
    });

    it("sums balances of one token", () => {
      expect(
        summarize([
          decode({ amount: "2", amountUsd: "2", token: usdc, type: "active" }),
          decode({ amount: "3", amountUsd: "3", token: usdc, type: "exiting" }),
        ])
      ).toEqual([{ amount: "5", amountUsd: "5", symbol: "USDC" }]);
    });
  });

  it("groups display rows by status, token identity, and date with exact sums", () => {
    const token = yieldApiYieldFixture().token;
    const usdcA = {
      ...token,
      address: "0x00000000000000000000000000000000000000a1",
      symbol: "USDC",
    };
    const usdcB = {
      ...usdcA,
      address: "0x00000000000000000000000000000000000000b2",
    };
    const decode = (overrides: Parameters<typeof yieldBalanceFixture>[0]) =>
      Schema.decodeSync(EarnBalance)(yieldBalanceFixture(overrides));
    const balances = [
      decode({ amount: "2", amountUsd: "2", token: usdcA, type: "active" }),
      decode({ amount: "1", amountUsd: "1", token: usdcB, type: "active" }),
      decode({ amount: "3", amountUsd: "3.1", token: usdcA, type: "active" }),
      decode({
        amount: "4",
        amountUsd: "4",
        date: "2026-11-01T00:00:00.000Z",
        token: usdcA,
        type: "exiting",
      }),
      decode({
        amount: "5",
        amountUsd: "5",
        date: "2026-12-01T00:00:00.000Z",
        token: usdcA,
        type: "exiting",
      }),
      decode({
        amount: "0.5",
        amountUsd: null,
        date: "2026-11-01T00:00:00.000Z",
        token: usdcA,
        type: "exiting",
      }),
    ];

    const rows = groupPositionBalanceRows(balances, () => false);

    expect(
      rows.map((row) => ({
        address: row.token.address,
        amount: row.amount.toFixed(),
        amountUsd: row.amountUsd.toFixed(),
        date: row.date?.toJSON(),
        type: row.type,
      }))
    ).toEqual([
      {
        address: usdcA.address,
        amount: "5",
        amountUsd: "5.1",
        date: undefined,
        type: "active",
      },
      {
        address: usdcB.address,
        amount: "1",
        amountUsd: "1",
        date: undefined,
        type: "active",
      },
      {
        address: usdcA.address,
        amount: "4.5",
        amountUsd: "4",
        date: "2026-11-01T00:00:00.000Z",
        type: "exiting",
      },
      {
        address: usdcA.address,
        amount: "5",
        amountUsd: "5",
        date: "2026-12-01T00:00:00.000Z",
        type: "exiting",
      },
    ]);
    expect(balances[0]?.amount.toFixed()).toBe("2");
  });

  it("exposes a scalar exit balance only for exactly one active token", () => {
    const token = yieldApiYieldFixture().token;
    const cake = { ...token, symbol: "CAKE" };
    const usdt = { ...token, symbol: "USDT" };
    const decode = (overrides: Parameters<typeof yieldBalanceFixture>[0]) =>
      Schema.decodeSync(EarnBalance)(
        yieldBalanceFixture({ type: "active", ...overrides })
      );

    const single = getSingleExitTokenSum([
      decode({ amount: "1", amountUsd: "2", token: cake }),
      decode({ amount: "0.5", amountUsd: "1", token: cake }),
      decode({
        amount: "100",
        amountUsd: "0",
        token: { ...token, isPoints: true, symbol: "PTS" },
      }),
    ]);

    expect(single?.token.symbol).toBe("CAKE");
    expect(single?.amount.toFixed()).toBe("1.5");
    expect(
      getSingleExitTokenSum([
        decode({ amount: "1", amountUsd: "2", token: cake }),
        decode({ amount: "3", amountUsd: "3", token: usdt }),
      ])
    ).toBeNull();
  });

  it("reports active positions per yield", () => {
    const position = makePosition();
    const positions = toPositionsData([position]);

    expect(hasActivePositionForYield(positions, position.yieldId)).toBe(true);
    expect(
      hasActivePositionForYield(
        positions,
        yieldApiYieldFixture({ id: "missing-yield" }).id
      )
    ).toBe(false);
  });

  it("groups non-zero balances by type", () => {
    const position = makePosition();
    const selected = getPositionBalances(
      getPositionData(toPositionsData([position]), position.yieldId),
      "default"
    );
    const byType = toPositionBalancesByType(selected?.balances ?? []);

    expect(byType.get("active")?.[0]?.tokenPriceInUsd.toFixed()).toBe("5");
    expect(byType.has("claimable")).toBe(false);
  });
});
