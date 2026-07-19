import { Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { EarnPosition } from "../../src/domain/schema/earn-models";
import { toPositionsData } from "../../src/domain/types/positions";
import { toPositionItems } from "../../src/features/portfolio/resources/positions";
import {
  getPositionsAverageApy,
  getPositionsTotal,
} from "../../src/features/portfolio/resources/summary";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../fixtures";

const makePosition = ({
  amountUsd,
  rewardRate,
  yieldId,
}: {
  readonly amountUsd: string;
  readonly rewardRate: number;
  readonly yieldId: string;
}) => {
  const yieldDto = yieldApiYieldFixture({
    id: yieldId,
    rewardRate: { components: [], rateType: "APY", total: rewardRate },
  });
  const position = Schema.decodeUnknownSync(EarnPosition)({
    balances: [
      yieldBalanceFixture({
        amount: "1",
        amountUsd,
        token: yieldDto.token,
      }),
    ],
    outputTokenBalance: null,
    yieldId: yieldDto.id,
  });
  const item = toPositionItems(toPositionsData([position]), false)[0]!;

  return { item, yieldDto };
};

describe("summary atom derivations", () => {
  it("recomputes position total and weighted APY when source state changes", () => {
    const first = makePosition({
      amountUsd: "5",
      rewardRate: 0.05,
      yieldId: "yield-1",
    });
    const second = makePosition({
      amountUsd: "15",
      rewardRate: 0.1,
      yieldId: "yield-2",
    });
    const yields = new Map([
      [first.yieldDto.id, first.yieldDto],
      [second.yieldDto.id, second.yieldDto],
    ]);
    const positionsAtom = Atom.make([first.item]);
    const totalAtom = Atom.make((get) =>
      getPositionsTotal(get(positionsAtom), yields)
    );
    const averageApyAtom = Atom.make((get) =>
      getPositionsAverageApy(get(positionsAtom), yields)
    );
    const registry = AtomRegistry.make();

    expect(registry.get(totalAtom).toFixed()).toBe("5");
    expect(registry.get(averageApyAtom).toFixed()).toBe("5");

    registry.set(positionsAtom, [first.item, second.item]);

    expect(registry.get(totalAtom).toFixed()).toBe("20");
    expect(registry.get(averageApyAtom).toFixed()).toBe("8.75");
  });
});
