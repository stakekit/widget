import { Option, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { EarnBalance, EarnPosition } from "../../src/domain/earn/models";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import {
  getPositionBalances,
  getPositionData,
  getSingleExitTokenSum,
  groupPositionBalanceRows,
  hasActivePositionForYield,
  sumBalancesByToken,
  toPositionBalancesByType,
  toPositionsData,
} from "../../src/domain/portfolio/positions";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import { toPositionItems } from "../../src/features/portfolio/state/read-models/positions";
import {
  PositionBalancesKey,
  PositionDataKey,
  positionBalancesAtom,
  positionDataAtom,
  yieldPositionsResourceAtom,
} from "../../src/resources/yield-positions/yield-positions";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../fixtures";

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

    expect(getPositionBalances(selected, "missing-balance-group")).toBeNull();
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

    const rows = groupPositionBalanceRows(balances);

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

  it("does not flag points-only claimable balances as actions", () => {
    const yieldDto = yieldApiYieldFixture();
    const position = Schema.decodeSync(EarnPosition)({
      balances: [
        yieldBalanceFixture({
          amount: "2",
          amountRaw: "2000000000000000000",
          amountUsd: "5",
          token: yieldDto.token,
          type: "active",
        }),
        yieldBalanceFixture({
          amount: "1214.8591",
          amountRaw: "12148591",
          amountUsd: "0",
          token: {
            ...yieldDto.token,
            isPoints: true,
            symbol: "KelpDAO Miles",
          },
          type: "claimable",
        }),
      ],
      outputTokenBalance: null,
      yieldId: yieldDto.id,
    });

    const [row] = toPositionItems(toPositionsData([position]), false);

    expect(row?.actionRequired).toBe(false);
  });

  it("deduplicates derived atom families by value-equal domain keys", () => {
    const { yieldId } = makePosition();
    const scope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x0000000000000000000000000000000000000001"
      ),
      network: "ethereum",
    });

    expect(positionDataAtom(new PositionDataKey({ scope, yieldId }))).toBe(
      positionDataAtom(new PositionDataKey({ scope, yieldId }))
    );
  });

  it("resolves position balances for an explicit wallet scope", () => {
    const position = makePosition();
    const scope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x0000000000000000000000000000000000000001"
      ),
      network: "ethereum",
    });
    const resource = yieldPositionsResourceAtom(scope);
    const balances = positionBalancesAtom(
      new PositionBalancesKey({
        balanceId: "default",
        scope,
        yieldId: position.yieldId,
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        [resource, AsyncResult.success({ errors: [], items: [position] })],
      ],
    });

    expect(
      Option.getOrNull(AsyncResult.value(registry.get(balances)))?.balances
    ).toHaveLength(2);
  });

  it("retains same-wallet position data only while revalidating and clears it across owners or successful absence", () => {
    const position = makePosition();
    const scopeA = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x0000000000000000000000000000000000000001"
      ),
      network: "ethereum",
    });
    const scopeB = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x0000000000000000000000000000000000000002"
      ),
      network: "ethereum",
    });
    const response = { errors: [], items: [position] };
    const resourceA = yieldPositionsResourceAtom(scopeA);
    const resourceB = yieldPositionsResourceAtom(scopeB);
    const selectedA = positionDataAtom(
      new PositionDataKey({ scope: scopeA, yieldId: position.yieldId })
    );
    const selectedB = positionDataAtom(
      new PositionDataKey({ scope: scopeB, yieldId: position.yieldId })
    );

    const readA = (result: Atom.Type<typeof resourceA>) =>
      AtomRegistry.make({ initialValues: [[resourceA, result]] }).get(
        selectedA
      );
    const readB = (result: Atom.Type<typeof resourceB>) =>
      AtomRegistry.make({ initialValues: [[resourceB, result]] }).get(
        selectedB
      );

    expect(
      Option.getOrNull(AsyncResult.value(readA(AsyncResult.success(response))))
    ).not.toBeNull();

    expect(
      Option.getOrNull(
        AsyncResult.value(
          readA(AsyncResult.waiting(AsyncResult.success(response)))
        )
      )
    ).not.toBeNull();

    expect(
      Option.getOrNull(
        AsyncResult.value(readB(AsyncResult.success({ errors: [], items: [] })))
      )
    ).toBeNull();
    expect(
      Option.getOrNull(
        AsyncResult.value(readA(AsyncResult.success({ errors: [], items: [] })))
      )
    ).toBeNull();
  });
});
