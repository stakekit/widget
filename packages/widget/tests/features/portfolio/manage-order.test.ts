import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { EarnPosition } from "../../../src/domain/earn/models";
import { toPositionsData } from "../../../src/domain/portfolio/positions";
import {
  isSmallBalance,
  splitSmallBalances,
  toBorrowManageOrder,
  toPositionItems,
} from "../../../src/features/portfolio/state/read-models/positions";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../../fixtures";

const makePosition = ({
  yieldId,
  amountUsd,
  pendingAction,
  type = "active",
}: {
  readonly yieldId: string;
  readonly amountUsd: string | null;
  readonly pendingAction?: "WITHDRAW" | "CLAIM_REWARDS";
  readonly type?: "active" | "claimable";
}) => {
  const yieldDto = yieldApiYieldFixture({ id: yieldId });

  return Schema.decodeSync(EarnPosition)({
    balances: [
      yieldBalanceFixture({
        amount: "1",
        ...(amountUsd === null ? { amountUsd: null } : { amountUsd }),
        token: yieldDto.token,
        type,
        pendingActions:
          pendingAction === undefined
            ? []
            : [
                {
                  intent: "manage",
                  passthrough: pendingAction,
                  type: pendingAction,
                },
              ],
      }),
    ],
    outputTokenBalance: null,
    yieldId: yieldDto.id,
  });
};

const order = (
  positions: ReadonlyArray<EarnPosition>,
  prioritizePendingClaims = false
) =>
  toPositionItems(toPositionsData(positions), prioritizePendingClaims).map(
    (item) => item.integrationId
  );

describe("Manage order", () => {
  it("puts positions asking for action first, then the rest by USD value", () => {
    expect(
      order([
        makePosition({ yieldId: "small", amountUsd: "2" }),
        makePosition({
          yieldId: "claim",
          amountUsd: "1",
          type: "claimable",
          pendingAction: "CLAIM_REWARDS",
        }),
        makePosition({ yieldId: "large", amountUsd: "500" }),
        makePosition({
          yieldId: "withdraw",
          amountUsd: "3",
          pendingAction: "WITHDRAW",
        }),
        makePosition({ yieldId: "unpriced", amountUsd: null }),
      ])
    ).toEqual(["withdraw", "claim", "large", "small", "unpriced"]);
  });

  it("puts claims ahead of other actions for a Host Profile that prioritizes them", () => {
    expect(
      order(
        [
          makePosition({
            yieldId: "withdraw",
            amountUsd: "3",
            pendingAction: "WITHDRAW",
          }),
          makePosition({
            yieldId: "claim",
            amountUsd: "1",
            type: "claimable",
            pendingAction: "CLAIM_REWARDS",
          }),
        ],
        true
      )
    ).toEqual(["claim", "withdraw"]);
  });
});

describe("Borrow Manage order", () => {
  const borrowPosition = ({
    healthFactor = null,
    id,
    ltv,
    suppliedUsd,
  }: {
    readonly healthFactor?: string | null;
    readonly id: string;
    readonly ltv: string;
    readonly suppliedUsd: string;
  }) => ({
    id,
    metrics: { totalSuppliedUsd: new BigNumber(suppliedUsd) },
    risk: {
      current: {
        borrowCapacityUsd: new BigNumber(0),
        healthFactor:
          healthFactor === null ? null : new BigNumber(healthFactor),
        liquidationCapacityUsd: new BigNumber(0),
        liquidationThreshold: new BigNumber(0.85),
        ltv: new BigNumber(ltv),
        maxLtv: new BigNumber(0.8),
        status: "available" as const,
        totalCollateralUsd: new BigNumber(suppliedUsd),
        totalDebtUsd: new BigNumber(0),
      },
    },
  });

  it("puts positions near their limits first, then the rest by supplied value", () => {
    expect(
      toBorrowManageOrder([
        borrowPosition({ id: "small", ltv: "0.1", suppliedUsd: "10" }),
        borrowPosition({ id: "near-ltv", ltv: "0.75", suppliedUsd: "5" }),
        borrowPosition({ id: "large", ltv: "0.1", suppliedUsd: "900" }),
        borrowPosition({
          healthFactor: "1.05",
          id: "near-liquidation",
          ltv: "0.1",
          suppliedUsd: "20",
        }),
      ]).map((position) => position.id)
    ).toEqual(["near-liquidation", "near-ltv", "large", "small"]);
  });
});

describe("small balances", () => {
  const items = toPositionItems(
    toPositionsData([
      makePosition({ yieldId: "dust", amountUsd: "0.004" }),
      makePosition({ yieldId: "cent", amountUsd: "0.01" }),
      makePosition({ yieldId: "unpriced", amountUsd: null }),
      makePosition({
        yieldId: "dust-claim",
        amountUsd: "0.001",
        type: "claimable",
        pendingAction: "CLAIM_REWARDS",
      }),
    ]),
    false
  );
  const byId = (id: string) => {
    const item = items.find((candidate) => candidate.integrationId === id);
    if (item === undefined) throw new Error(`Expected position ${id}.`);
    return item;
  };

  it("are priced positions worth less than a cent that ask for nothing", () => {
    expect(isSmallBalance(byId("dust"))).toBe(true);
    expect(isSmallBalance(byId("cent"))).toBe(false);
    // An unknown worth may be large, and an action stays in view.
    expect(isSmallBalance(byId("unpriced"))).toBe(false);
    expect(isSmallBalance(byId("dust-claim"))).toBe(false);
  });

  it("split from the shown positions, each side keeping its order", () => {
    const { shown, small } = splitSmallBalances(items);

    expect(shown.map((item) => item.integrationId)).toEqual([
      "dust-claim",
      "cent",
      "unpriced",
    ]);
    expect(small.map((item) => item.integrationId)).toEqual(["dust"]);
  });
});
