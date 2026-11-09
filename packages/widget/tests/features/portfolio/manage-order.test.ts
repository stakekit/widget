import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { EarnPosition } from "../../../src/domain/earn/balance";
import { toPositionsData } from "../../../src/domain/portfolio/positions";
import {
  toBorrowManageOrder,
  toPositionItems,
} from "../../../src/features/portfolio/model/positions";
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

  it("puts danger ahead of caution, whatever their value", () => {
    expect(
      toBorrowManageOrder([
        borrowPosition({ id: "caution", ltv: "0.75", suppliedUsd: "900" }),
        borrowPosition({ id: "danger", ltv: "0.9", suppliedUsd: "5" }),
      ]).map((position) => position.id)
    ).toEqual(["danger", "caution"]);
  });
});

describe("positions worth less than a cent", () => {
  it("stay in the list, sinking below larger positions unless they ask for action", () => {
    const items = toPositionItems(
      toPositionsData([
        makePosition({ yieldId: "dust", amountUsd: "0.004" }),
        makePosition({ yieldId: "large", amountUsd: "25" }),
        makePosition({
          yieldId: "dust-claim",
          amountUsd: "0.001",
          type: "claimable",
          pendingAction: "CLAIM_REWARDS",
        }),
        makePosition({ yieldId: "cent", amountUsd: "0.01" }),
      ]),
      false
    );

    expect(items.map((item) => item.integrationId)).toEqual([
      "dust-claim",
      "large",
      "cent",
      "dust",
    ]);
  });
});

describe("Manage row projection", () => {
  const yieldDto = yieldApiYieldFixture();
  const rowFor = (
    balances: ReadonlyArray<Parameters<typeof yieldBalanceFixture>[0]>
  ) =>
    toPositionItems(
      toPositionsData([
        Schema.decodeSync(EarnPosition)({
          balances: balances.map((balance) => yieldBalanceFixture(balance)),
          outputTokenBalance: null,
          yieldId: yieldDto.id,
        }),
      ]),
      false
    );
  const withPendingActions = (types: ReadonlyArray<string>) =>
    types.map((type) => ({ intent: "manage", passthrough: type, type }));

  it("totals a priced second token into the primary Value Token", () => {
    const usdc = {
      ...yieldDto.token,
      address: "0x00000000000000000000000000000000000000a1",
      symbol: "USDC",
    };
    const dai = {
      ...usdc,
      address: "0x00000000000000000000000000000000000000d1",
      symbol: "DAI",
    };
    const [item] = rowFor([
      { amount: "1", amountUsd: "2", token: dai, type: "entering" },
      { amount: "2", amountUsd: "2", token: usdc, type: "active" },
    ]);

    expect(
      item?.total.map((sum) => [sum.amount.toFixed(), sum.token.symbol])
    ).toEqual([["4", "USDC"]]);
  });

  it("lists only balances with an amount", () => {
    const rows = rowFor([
      { amount: "2", amountUsd: "5", type: "active", token: yieldDto.token },
      { amount: "0", amountUsd: "0", type: "claimable", token: yieldDto.token },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.balancesWithAmount).toHaveLength(1);
  });

  it("does not flag points-only claimable balances as actions", () => {
    const [row] = rowFor([
      {
        amount: "2",
        amountRaw: "2000000000000000000",
        amountUsd: "5",
        token: yieldDto.token,
        type: "active",
      },
      {
        amount: "1214.8591",
        amountRaw: "12148591",
        amountUsd: "0",
        token: { ...yieldDto.token, isPoints: true, symbol: "KelpDAO Miles" },
        type: "claimable",
      },
    ]);

    expect(row?.requiredAction).toBeNull();
  });

  it.each([
    ["only an optional cancellation", ["CANCEL_PENDING"], null, true],
    [
      "a required action next to a cancellation",
      ["CANCEL_PENDING", "WITHDRAW"],
      "withdraw",
      false,
    ],
  ] as const)(
    "flags %s as in progress rather than required",
    (_, types, requiredAction, hasPendingRequest) => {
      const [row] = rowFor([
        {
          amount: "1",
          amountRaw: "1000000000000000000",
          amountUsd: "1",
          pendingActions: withPendingActions(types),
          token: yieldDto.token,
          type: "entering",
        },
      ]);

      expect(row?.requiredAction).toBe(requiredAction);
      expect(row?.hasPendingRequest).toBe(hasPendingRequest);
    }
  );

  it.each([
    [
      "a finished unstake to collect",
      "exiting",
      ["CLAIM_UNSTAKED"],
      "withdraw",
    ],
    ["a locked balance to unlock", "locked", ["UNLOCK_LOCKED"], "unlock"],
    [
      "a locked balance with nothing to unlock",
      "locked",
      ["VOTE_LOCKED"],
      "locked",
    ],
    ["a required action it cannot name", "active", ["VOTE"], "other"],
  ] as const)("names %s", (_, balanceType, types, requiredAction) => {
    const [row] = rowFor([
      {
        amount: "1",
        amountRaw: "1000000000000000000",
        amountUsd: "1",
        pendingActions: withPendingActions(types),
        token: yieldDto.token,
        type: balanceType,
      },
    ]);

    expect(row?.requiredAction).toBe(requiredAction);
  });

  it("flags an encrypted unwrap still to withdraw as in progress, since its instant withdrawal already began", () => {
    const [row] = rowFor([
      {
        amount: "0",
        amountRaw: "0",
        isEncrypted: true,
        pendingActions: withPendingActions(["WITHDRAW"]),
        shareAmountRaw: `0x${"ab".repeat(32)}`,
        token: yieldDto.token,
        type: "withdrawable",
      },
    ]);

    expect(row?.requiredAction).toBeNull();
    expect(row?.hasPendingRequest).toBe(true);
  });
});
