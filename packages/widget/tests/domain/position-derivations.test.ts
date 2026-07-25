import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { EarnPosition } from "../../src/domain/schema/earn-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  getPositionBalances,
  getPositionData,
  toPositionBalancesByType,
  toPositionsData,
} from "../../src/domain/types/positions";
import {
  PositionBalancesKey,
  PositionDataKey,
  positionBalancesAtom,
  positionDataAtom,
  toPositionItems,
} from "../../src/features/portfolio/state";
import { yieldPositionsResourceAtom } from "../../src/resources/yield-positions/yield-positions";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
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
