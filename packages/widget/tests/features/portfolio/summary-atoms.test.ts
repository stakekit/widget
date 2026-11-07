import BigNumber from "bignumber.js";
import { Cause, Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { fillConfidentialPosition } from "../../../src/domain/earn/confidential";
import {
  EarnPosition,
  getEncryptedHandle,
} from "../../../src/domain/earn/models";
import { getYieldCategory } from "../../../src/domain/earn/yield";
import type { exactDecimal } from "../../../src/domain/finance/exact";
import { toPositionsData } from "../../../src/domain/portfolio/positions";
import {
  currentGroupedPositionsAtom,
  positionsTableDataAtom,
  toPositionItems,
} from "../../../src/features/portfolio/state/read-models/positions";
import {
  allPositionsSummaryAtom,
  averageApySummaryAtom,
  deriveManageSummary,
  getClaimableRewardsUsd,
  getPositionsAverageApy,
  getPositionsTotal,
  hasHiddenPositions,
  manageSummaryAtom,
} from "../../../src/features/portfolio/state/read-models/summary";
import {
  MultiYieldsKey,
  multiYieldsByIdAtom,
} from "../../../src/features/yield-summary/state/multi-yields";
import {
  YieldDirectoryKey,
  yieldDirectoryResourceAtom,
} from "../../../src/resources/yield-directory/index";
import {
  ApiRequestError,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import type { Presentable } from "../../../src/shared/effect/async-result";
import {
  confidentialYieldFixture,
  yieldApiProviderFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../../fixtures";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const makePosition = ({
  amount = "1",
  amountUsd,
  handle,
  revealed,
  rewardRate,
  yieldId,
}: {
  readonly amount?: string;
  readonly amountUsd: string | null;
  /** An encrypted balance's handle, for a confidential position. */
  readonly handle?: string;
  /** The cleartext the user revealed for that handle. */
  readonly revealed?: bigint;
  readonly rewardRate: Parameters<typeof exactDecimal>[0];
  readonly yieldId: string;
}) => {
  const yieldDto = yieldApiYieldFixture({
    id: yieldId,
    rewardRate: { components: [], rateType: "APY", total: rewardRate },
  });
  const decoded = Schema.decodeSync(EarnPosition)({
    balances: [
      yieldBalanceFixture({
        amount,
        ...(amountUsd === null ? { amountUsd: null } : { amountUsd }),
        ...(handle ? { isEncrypted: true, shareAmountRaw: handle } : {}),
        token: yieldDto.token,
      }),
    ],
    outputTokenBalance: null,
    yieldId: yieldDto.id,
  });
  const encryptedHandle = decoded.balances[0]
    ? getEncryptedHandle(decoded.balances[0])
    : null;
  const position =
    encryptedHandle && revealed !== undefined
      ? fillConfidentialPosition(
          decoded,
          new Map([[encryptedHandle, revealed]])
        )
      : decoded;
  const item = toPositionItems(toPositionsData([position]), false)[0]!;

  return { item, yieldDto };
};

describe("claimable rewards", () => {
  it("sums the USD value of every position's claimable balances", () => {
    const yieldDto = yieldApiYieldFixture({ id: "rewarding-yield" });
    const position = Schema.decodeSync(EarnPosition)({
      balances: [
        yieldBalanceFixture({
          amount: "10",
          amountUsd: "10",
          token: yieldDto.token,
        }),
        yieldBalanceFixture({
          amount: "2",
          amountUsd: "2.5",
          token: yieldDto.token,
          type: "claimable",
        }),
      ],
      outputTokenBalance: null,
      yieldId: yieldDto.id,
    });
    const unclaimable = makePosition({
      amountUsd: "7",
      rewardRate: 0.05,
      yieldId: "plain-yield",
    });

    expect(
      getClaimableRewardsUsd([
        ...toPositionItems(toPositionsData([position]), false),
        unclaimable.item,
      ]).toFixed()
    ).toBe("2.5");
    expect(getClaimableRewardsUsd([unclaimable.item]).toFixed()).toBe("0");
  });
});

describe("summary atom derivations", () => {
  it("matches the Manage summary zeros when a position has amount but no amountUsd", () => {
    // Screenshot repro: list shows "0.2 USDG" + "3.92%" while Total staked is $0.00
    // and Average APY is "-". The list renders token amount without a USD subline when
    // amountUsd is missing; summary only sums amountUsd and skips APY when USD is 0.
    const position = makePosition({
      amount: "0.2",
      amountUsd: null,
      rewardRate: 0.0392,
      yieldId: "robinhood-usdg-morpho-steakhouse-v2",
    });
    const yields = new Map([[position.yieldDto.id, position.yieldDto]]);

    expect(position.item.balancesWithAmount[0]?.amount.toFixed()).toBe("0.2");
    expect(getPositionsTotal([position.item], yields).toFixed()).toBe("0");
    expect(getPositionsAverageApy([position.item], yields).toFixed()).toBe("0");
  });

  it("also zeros the summary when the Yield is missing from the multi-yield map", () => {
    const position = makePosition({
      amount: "0.2",
      amountUsd: "0.2",
      rewardRate: 0.0392,
      yieldId: "robinhood-usdg-morpho-steakhouse-v2",
    });

    expect(getPositionsTotal([position.item], new Map()).toFixed()).toBe("0");
    expect(getPositionsAverageApy([position.item], new Map()).toFixed()).toBe(
      "0"
    );
  });

  it("leaves hidden confidential positions out of the totals until revealed", () => {
    const plain = makePosition({
      amountUsd: "4",
      rewardRate: 0.05,
      yieldId: "plain-vault",
    });
    const confidential = {
      amountUsd: "6",
      handle: `0x${"ab".repeat(32)}`,
      rewardRate: 0.12,
      yieldId: confidentialYieldFixture().id,
    };
    const hidden = makePosition(confidential);
    const revealed = makePosition({ ...confidential, revealed: 10n ** 18n });
    const otherHidden = makePosition({
      amountUsd: "3",
      handle: `0x${"cd".repeat(32)}`,
      rewardRate: 0.2,
      yieldId: "other-confidential-vault",
    });
    const yields = new Map([
      [plain.yieldDto.id, plain.yieldDto],
      [hidden.yieldDto.id, hidden.yieldDto],
      [otherHidden.yieldDto.id, otherHidden.yieldDto],
    ]);

    const hiddenPositions = [plain.item, hidden.item];
    expect(getPositionsTotal(hiddenPositions, yields).toFixed()).toBe("4");
    expect(getPositionsAverageApy(hiddenPositions, yields).toFixed()).toBe("5");
    expect(hasHiddenPositions(hiddenPositions)).toBe(true);

    const revealedPositions = [plain.item, revealed.item];
    expect(getPositionsTotal(revealedPositions, yields).toFixed()).toBe("10");
    expect(getPositionsAverageApy(revealedPositions, yields).toFixed()).toBe(
      "9.2"
    );
    expect(hasHiddenPositions(revealedPositions)).toBe(false);

    const partiallyHidden = [plain.item, revealed.item, otherHidden.item];
    expect(getPositionsTotal(partiallyHidden, yields).toFixed()).toBe("10");
    expect(hasHiddenPositions(partiallyHidden)).toBe(true);
  });

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

  it("retains a non-enterable Yield referenced by a historical position", () => {
    const historicalYield = yieldApiYieldFixture({
      status: { enter: false, exit: true },
    });
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(YieldResourceSource, {
            getProvider: () => Effect.succeedSome(yieldApiProviderFixture()),
            listYields: () =>
              Effect.succeed({
                items: [historicalYield],
                limit: 100,
                offset: 0,
                total: 1,
              }),
          } as never)
        ),
      ],
    });

    const key = new MultiYieldsKey({ yieldIds: [historicalYield.id] });
    const result = registry.get(multiYieldsByIdAtom(key));
    const yields = AsyncResult.getOrThrow(result);
    const historicalPosition = makePosition({
      amountUsd: "5",
      rewardRate: historicalYield.rewardRate.total,
      yieldId: historicalYield.id,
    });

    expect(yields.has(historicalYield.id)).toBe(true);
    expect(getPositionsTotal([historicalPosition.item], yields).toFixed()).toBe(
      "5"
    );
  });

  it("publishes Portfolio summaries as AsyncResult without dropping failures", () => {
    const position = makePosition({
      amountUsd: "5",
      rewardRate: 0.05,
      yieldId: "yield-1",
    });
    const key = new MultiYieldsKey({ yieldIds: [position.yieldDto.id] });
    const successfulRegistry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        [positionsTableDataAtom, AsyncResult.success([position.item])],
        [
          multiYieldsByIdAtom(key),
          AsyncResult.success(
            new Map([[position.yieldDto.id, position.yieldDto]])
          ),
        ],
      ],
    });

    expect(
      AsyncResult.getOrThrow(
        successfulRegistry.get(allPositionsSummaryAtom)
      ).allPositionsSum.toFixed()
    ).toBe("5");

    const failure = new Error("Yield summary unavailable");
    const failedRegistry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        [positionsTableDataAtom, AsyncResult.success([position.item])],
        [multiYieldsByIdAtom(key), AsyncResult.fail(failure)],
      ],
    });
    const failed = failedRegistry.get(allPositionsSummaryAtom);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    expect(AsyncResult.error(failed)).toEqual(Option.some(failure));

    successfulRegistry.dispose();
    failedRegistry.dispose();
  });

  it("keeps the last positions total and average APY when a Yield directory refetch fails", () => {
    const position = makePosition({
      amountUsd: "5",
      rewardRate: 0.05,
      yieldId: "yield-1",
    });
    let offline = false;
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(YieldResourceSource, {
            getProvider: () => Effect.succeedNone,
            listYields: () =>
              offline
                ? Effect.fail(
                    new ApiRequestError({
                      cause: new Error("rejected"),
                      // Fails at once: a transient failure is asked again
                      // with backoff first.
                      failure: { _tag: "ErrorStatus", status: 400, body: null },
                      operation: "yields",
                    })
                  )
                : Effect.succeed({
                    items: [position.yieldDto],
                    limit: 100,
                    offset: 0,
                    total: 1,
                  }),
          } as never)
        ),
        [positionsTableDataAtom, AsyncResult.success([position.item])],
      ],
    });
    const unmountTotal = registry.mount(allPositionsSummaryAtom);
    const unmountApy = registry.mount(averageApySummaryAtom);

    try {
      expect(
        AsyncResult.getOrThrow(
          registry.get(allPositionsSummaryAtom)
        ).allPositionsSum.toFixed()
      ).toBe("5");
      expect(
        AsyncResult.getOrThrow(registry.get(averageApySummaryAtom)).toFixed()
      ).toBe("5");

      offline = true;
      registry.refresh(
        yieldDirectoryResourceAtom.local(
          new YieldDirectoryKey({ yieldIds: [position.yieldDto.id] })
        )
      );
      const refetched = registry.get(allPositionsSummaryAtom);

      expect(AsyncResult.isFailure(refetched)).toBe(true);
      expect(
        refetched
          .pipe(AsyncResult.value, Option.getOrThrow)
          .allPositionsSum.toFixed()
      ).toBe("5");
      const refetchedApy = registry.get(averageApySummaryAtom);

      expect(AsyncResult.isFailure(refetchedApy)).toBe(true);
      expect(
        refetchedApy.pipe(AsyncResult.value, Option.getOrThrow).toFixed()
      ).toBe("5");

      const summary = registry.get(manageSummaryAtom);
      expect(summary.totalValue).toEqual({
        _tag: "Ready",
        value: new BigNumber(5),
      });
      expect(summary.averageApy).toEqual({
        _tag: "Ready",
        value: new BigNumber(5),
      });
      expect(summary.isPartial).toBe(false);
    } finally {
      unmountApy();
      unmountTotal();
      registry.dispose();
    }
  });

  it("publishes category-grouped position rows from the Portfolio atom", async () => {
    const position = makePosition({
      amountUsd: "5",
      rewardRate: 0.05,
      yieldId: "yield-1",
    });
    const category = getYieldCategory(position.yieldDto);
    if (!category) throw new Error("expected a dashboard Yield category");
    const listYields = vi.fn(() =>
      Effect.succeed({
        items: [position.yieldDto],
        limit: 100,
        offset: 0,
        total: 1,
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(YieldResourceSource, {
            listYields,
          } as never)
        ),
        applicationRuntimeInitInitialValue({
          apiKey: "test-key",
          baseUrl: "https://api.example.com",
          dashboardVariant: true,
          variant: "default",
          yieldGrouping: "category",
          yieldsApiUrl: "https://yield.example.com",
        }),
        [positionsTableDataAtom, AsyncResult.success([position.item])],
      ],
    });
    const resource = currentGroupedPositionsAtom;
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(registry.get(resource)).toEqual([
        { kind: "chain-modal" },
        { category, count: 1, kind: "section" },
        {
          item: { kind: "earn", position: position.item },
          kind: "position",
        },
      ])
    );
    expect(listYields).toHaveBeenCalledOnce();

    unmount();
    registry.dispose();
  });

  it("lists a position worth less than a cent as a row in its category", async () => {
    const position = makePosition({
      amountUsd: "5",
      rewardRate: 0.05,
      yieldId: "yield-1",
    });
    const dust = makePosition({
      amount: "0.0000001",
      amountUsd: "0.0003",
      rewardRate: 0.05,
      yieldId: "yield-2",
    });
    const category = getYieldCategory(position.yieldDto);
    if (!category) throw new Error("expected a dashboard Yield category");
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(YieldResourceSource, {
            listYields: () =>
              Effect.succeed({
                items: [position.yieldDto, dust.yieldDto],
                limit: 100,
                offset: 0,
                total: 2,
              }),
          } as never)
        ),
        applicationRuntimeInitInitialValue({
          apiKey: "test-key",
          baseUrl: "https://api.example.com",
          dashboardVariant: true,
          variant: "default",
          yieldGrouping: "category",
          yieldsApiUrl: "https://yield.example.com",
        }),
        [
          positionsTableDataAtom,
          AsyncResult.success([position.item, dust.item]),
        ],
      ],
    });
    const resource = currentGroupedPositionsAtom;
    const unmount = registry.mount(resource);

    await vi.waitFor(() =>
      expect(registry.get(resource)).toEqual([
        { kind: "chain-modal" },
        { category, count: 2, kind: "section" },
        {
          item: { kind: "earn", position: position.item },
          kind: "position",
        },
        { item: { kind: "earn", position: dust.item }, kind: "position" },
      ])
    );

    unmount();
    registry.dispose();
  });
});

describe("Manage summary", () => {
  const ready = <A>(value: A): Presentable<A, unknown> => ({
    _tag: "Ready",
    refreshFailure: Option.none(),
    refreshing: false,
    value,
  });
  const failed: Presentable<never, unknown> = {
    _tag: "Failed",
    cause: Cause.fail(new Error("unavailable")),
  };
  const loading: Presentable<never, unknown> = { _tag: "Loading" };
  const earn = {
    averageApy: ready(new BigNumber("3.97")),
    claimableRewards: ready(new BigNumber("5.09")),
    earnPositions: ready([]),
    earnValue: ready({
      allPositionsSum: new BigNumber(1_230_000),
      excludesHidden: false,
    }),
  };
  const borrow = {
    positions: ready([{}, {}]),
    totals: ready({
      totalBorrowedUsd: new BigNumber(18_250),
      totalSuppliedUsd: new BigNumber(30_720),
    }),
  };
  const readyFigure = (value: BigNumber.Value) => ({
    _tag: "Ready",
    value: new BigNumber(value),
  });
  const unavailable = { _tag: "Unavailable" };

  it("shows the same figures without borrow positions in every Layout", () => {
    expect(deriveManageSummary({ ...earn, borrow: null })).toEqual({
      averageApy: readyFigure("3.97"),
      borrow: null,
      claimableRewards: readyFigure("5.09"),
      excludesHidden: false,
      isPartial: false,
      totalValue: readyFigure(1_230_000),
    });
  });

  it("adds borrow collateral to the total and shows debt and net worth, keeping the Earn APY", () => {
    expect(deriveManageSummary({ ...earn, borrow })).toEqual({
      averageApy: readyFigure("3.97"),
      borrow: { debt: readyFigure(18_250), netWorth: readyFigure(1_242_470) },
      claimableRewards: readyFigure("5.09"),
      excludesHidden: false,
      isPartial: false,
      totalValue: readyFigure(1_260_720),
    });
  });

  it("leaves out debt and net worth while borrow positions owe nothing", () => {
    const summary = deriveManageSummary({
      ...earn,
      borrow: {
        ...borrow,
        totals: ready({
          totalBorrowedUsd: new BigNumber(0),
          totalSuppliedUsd: new BigNumber(30_720),
        }),
      },
    });

    expect(summary).toMatchObject({
      borrow: null,
      totalValue: readyFigure(1_260_720),
    });
  });

  it("marks Earn figures partial instead of totalling the borrow positions alone", () => {
    const summary = deriveManageSummary({
      averageApy: failed,
      borrow,
      claimableRewards: failed,
      earnPositions: failed,
      earnValue: failed,
    });

    expect(summary).toMatchObject({
      averageApy: unavailable,
      borrow: { debt: readyFigure(18_250), netWorth: unavailable },
      claimableRewards: unavailable,
      isPartial: true,
      totalValue: unavailable,
    });
  });

  it("marks the total partial when borrow positions fail", () => {
    const summary = deriveManageSummary({
      ...earn,
      borrow: { positions: failed, totals: failed },
    });

    expect(summary).toMatchObject({
      averageApy: readyFigure("3.97"),
      borrow: null,
      isPartial: true,
      totalValue: unavailable,
    });
  });

  it("is not partial when every source failed, and loads while one loads", () => {
    expect(
      deriveManageSummary({
        averageApy: failed,
        borrow: null,
        claimableRewards: failed,
        earnPositions: failed,
        earnValue: failed,
      }).isPartial
    ).toBe(false);
    expect(
      deriveManageSummary({
        ...earn,
        borrow: { positions: loading, totals: loading },
      }).totalValue
    ).toEqual({ _tag: "Loading" });
  });
});
