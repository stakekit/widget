import BigNumber from "bignumber.js";
import { Effect, Layer, Option, Schema } from "effect";
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
import { TokenBalancesResponse } from "../../../src/domain/finance/models";
import { Prices } from "../../../src/domain/health/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { toPositionsData } from "../../../src/domain/portfolio/positions";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  currentGroupedPositionsAtom,
  positionsTableDataAtom,
  toPositionItems,
} from "../../../src/features/portfolio/state/read-models/positions";
import {
  allPositionsSummaryAtom,
  availableBalanceSummaryAtom,
  averageApySummaryAtom,
  getClaimableRewardsUsd,
  getPositionsAverageApy,
  getPositionsTotal,
  hasHiddenPositions,
  summaryViewAtom,
} from "../../../src/features/portfolio/state/read-models/summary";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import {
  MultiYieldsKey,
  multiYieldsByIdAtom,
} from "../../../src/features/yield-summary/state/multi-yields";
import {
  TokenPricesKey,
  tokenPricesResourceAtom,
} from "../../../src/resources/token-prices/token-prices";
import {
  YieldDirectoryKey,
  yieldDirectoryResourceAtom,
} from "../../../src/resources/yield-directory/index";
import {
  ApiRequestError,
  LegacyResourceSource,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
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
                      cause: new Error("offline"),
                      failure: { _tag: "Unreachable" },
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

      const { allPositions, averageApy } = registry.get(summaryViewAtom);
      if (allPositions._tag !== "Ready" || averageApy._tag !== "Ready") {
        throw new Error("expected the summary to keep its values");
      }
      expect(allPositions.value.allPositionsSum.toFixed()).toBe("5");
      expect(Option.isSome(allPositions.refreshFailure)).toBe(true);
      expect(averageApy.value.toFixed()).toBe("5");
      expect(Option.isSome(averageApy.refreshFailure)).toBe(true);
    } finally {
      unmountApy();
      unmountTotal();
      registry.dispose();
    }
  });

  it("keeps the last available balance total when a prices refetch fails", () => {
    const eth = yieldApiYieldFixture().token;
    const usdc = {
      ...eth,
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      name: "USD Coin",
      symbol: "USDC",
    };
    const walletScope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0x9999999999999999999999999999999999999999"
      ),
      network: "ethereum",
    });
    const tokenBalances = Schema.decodeSync(TokenBalancesResponse)([
      { amount: "2", availableYields: [], token: eth },
      { amount: "10", availableYields: [], token: usdc },
    ]);
    let offline = false;
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(walletScopeAtom, walletScope),
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(LegacyResourceSource, {
            getPrices: () =>
              offline
                ? Effect.fail(
                    new ApiRequestError({
                      cause: new Error("offline"),
                      failure: { _tag: "Unreachable" },
                      operation: "prices",
                    })
                  )
                : Effect.succeed(
                    new Prices(
                      new Map([
                        [
                          `ethereum-${eth.address?.toLowerCase() ?? ""}`,
                          { price: new BigNumber(2000), price24H: undefined },
                        ],
                        [
                          `ethereum-${usdc.address}`,
                          { price: new BigNumber(1), price24H: undefined },
                        ],
                      ])
                    )
                  ),
            scanTokenBalances: () => Effect.succeed(tokenBalances),
          } as never)
        ),
      ],
    });
    const unmount = registry.mount(availableBalanceSummaryAtom);

    try {
      expect(
        AsyncResult.getOrThrow(
          registry.get(availableBalanceSummaryAtom)
        )?.toFixed()
      ).toBe("4010");

      offline = true;
      registry.refresh(
        tokenPricesResourceAtom.local(
          new TokenPricesKey({
            currency: "USD",
            tokenList: tokenBalances.map((balance) => balance.token),
          })
        )
      );
      const refetched = registry.get(availableBalanceSummaryAtom);

      expect(AsyncResult.isFailure(refetched)).toBe(true);
      expect(
        refetched.pipe(AsyncResult.value, Option.getOrThrow)?.toFixed()
      ).toBe("4010");
    } finally {
      unmount();
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

  it("collapses small balances into one row after the grouped positions", async () => {
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
                items: [position.yieldDto],
                limit: 100,
                offset: 0,
                total: 1,
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
          AsyncResult.success([dust.item, position.item]),
        ],
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
        { items: [dust.item], kind: "small-balances" },
      ])
    );

    unmount();
    registry.dispose();
  });
});
