import BigNumber from "bignumber.js";
import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../src/domain/borrow/catalog/market";
import { BorrowAccountSnapshot } from "../../../src/domain/borrow/positions/borrow-account-snapshot";
import {
  deriveBorrowPositions,
  emptyBorrowPositions,
} from "../../../src/domain/borrow/positions/borrow-positions";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  BorrowPositionKey,
  BorrowPositionNotFound,
  borrowPositionAtom,
  currentBorrowPositionsAtom,
} from "../../../src/features/borrow/positions/state/positions";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import { borrowIntegrationsResourceAtom as borrowIntegrationsAtom } from "../../../src/resources/borrow-integrations/borrow-integrations";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom as borrowMarketsAtom,
} from "../../../src/resources/borrow-markets/borrow-markets";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom as borrowPositionsAtom,
} from "../../../src/resources/borrow-positions/borrow-positions";
import { BorrowResourceError as BorrowAtomError } from "../../../src/resources/borrow-resource-error";
import { makeBorrowResourceSource } from "../../../src/services/api/borrow-resource-source";
import {
  ApiRequestError,
  BorrowResourceSource,
} from "../../../src/services/api/resource-sources";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});

const integrationDto = {
  id: "aave-borrow",
  providerId: "aave",
  name: "Aave V3",
  networks: ["ethereum"],
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  actions: [],
} as const;

const marketDto = {
  id: "aave-v3-ethereum-usdc",
  integrationId: integrationDto.id,
  network: "ethereum",
  type: "pool",
  poolAddress: "0x0000000000000000000000000000000000000001",
  loanToken: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  collateralTokens: [
    {
      token: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
      },
      priceUsd: "2000",
      maxLtv: "0.8",
      liquidationThreshold: "0.85",
      liquidationPenalty: "0.05",
      supplyRate: "0.02",
    },
  ],
  borrowRate: "0.06",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  utilizationRate: "0.5",
  loanTokenPriceUsd: "1",
  isBorrowEnabled: true,
  supplyCollateralFeeBps: "0",
  feeWrapperAddress: null,
  originationFeeBps: "0",
  originationFeeWrapperAddress: null,
  minLoan: null,
} as const;

const positionDto = {
  address,
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  debtBalances: [
    {
      apy: "0.06",
      balance: "400",
      balanceRaw: "400000000",
      balanceUsd: "400",
      marketId: marketDto.id,
      pendingActions: [],
      tokenAddress: marketDto.loanToken.address,
      tokenSymbol: "USDC",
    },
  ],
  healthFactor: "2.125",
  integrationId: integrationDto.id,
  netApy: "-0.006",
  netWorthUsd: "600",
  network: "ethereum",
  supplyBalances: [],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "0",
  totalSuppliedUsd: "0",
} as const;

const makeRegistry = (borrow: Record<string, unknown>) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(Layer.succeed(BorrowResourceSource, borrow as never))
      ),
    ],
  });

describe("Borrow Positions resource atoms", () => {
  it("fetches, decodes, and derives borrow positions through atom resources", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
      positionDto
    );
    const registry = makeRegistry({
      getIntegrations: () => Effect.succeed([integration]),
      getMarkets: () =>
        Effect.succeed({
          items: [market],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      getPositionData: () => Effect.succeed([{ integration, position }]),
    });

    const result = registry.get(
      borrowPositionsAtom(
        new BorrowPositionsKey({
          scope: walletScope,
        })
      )
    );

    expect(AsyncResult.isSuccess(result)).toBe(true);
    if (AsyncResult.isSuccess(result)) {
      expect(result.value.items[0]?.id).toBe(marketDto.id);
      expect(result.value.items[0]?.balances.debt?.balance).toEqual(
        new BigNumber(400)
      );
    }
  });

  it("resolves current borrow positions from wallet scope inside the atom runtime", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
      positionDto
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Layer.succeed(BorrowResourceSource, {
              getIntegrations: () => Effect.succeed([integration]),
              getMarkets: () =>
                Effect.succeed({
                  items: [market],
                  limit: 100,
                  offset: 0,
                  total: 1,
                }),
              getPositionData: () =>
                Effect.succeed([{ integration, position }]),
            } as never)
          )
        ),
        Atom.initialValue(walletScopeAtom, walletScope),
        applicationRuntimeInitInitialValue({
          apiKey: "api-key",
          borrowEnabled: true,
          dashboardVariant: true,
          variant: "default",
        }),
      ],
    });

    expect(
      AsyncResult.getOrThrow(registry.get(currentBorrowPositionsAtom))[0]?.id
    ).toBe(market.id);
  });

  it("returns inert resources without calling Borrow transport when disabled", () => {
    const getIntegrations = vi.fn();
    const getMarkets = vi.fn();
    const getPositionData = vi.fn();
    const source = makeBorrowResourceSource(
      {
        IntegrationsControllerGetIntegrationsV1: getIntegrations,
        MarketsControllerGetMarketsV1: getMarkets,
        PositionsControllerGetPositionsV1: getPositionData,
      } as never,
      false
    );
    const registry = makeRegistry(source);

    expect(
      AsyncResult.getOrThrow(registry.get(borrowIntegrationsAtom))
    ).toEqual([]);
    expect(
      AsyncResult.getOrThrow(
        registry.get(
          borrowMarketsAtom(new BorrowMarketsKey({ network: "ethereum" }))
        )
      )
    ).toEqual([]);
    expect(
      AsyncResult.getOrThrow(
        registry.get(
          borrowPositionsAtom(new BorrowPositionsKey({ scope: walletScope }))
        )
      )
    ).toMatchObject({ items: [] });
    expect(getIntegrations).not.toHaveBeenCalled();
    expect(getMarkets).not.toHaveBeenCalled();
    expect(getPositionData).not.toHaveBeenCalled();
  });

  it("shares one positions request between list and detail consumers", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
      positionDto
    );
    const getIntegrations = vi.fn(() => Effect.succeed([integration]));
    const getMarkets = vi.fn(() =>
      Effect.succeed({
        items: [market],
        limit: 100,
        offset: 0,
        total: 1,
      })
    );
    const getPositionData = vi.fn(() =>
      Effect.succeed([{ integration, position }])
    );
    const registry = makeRegistry({
      getIntegrations,
      getMarkets,
      getPositionData,
    });

    expect(
      AsyncResult.getOrThrow(registry.get(borrowIntegrationsAtom))
    ).toHaveLength(1);
    expect(
      AsyncResult.getOrThrow(
        registry.get(
          borrowMarketsAtom(new BorrowMarketsKey({ network: "ethereum" }))
        )
      )
    ).toHaveLength(1);
    const list = registry.get(
      borrowPositionsAtom(new BorrowPositionsKey({ scope: walletScope }))
    );
    const detail = registry.get(
      borrowPositionAtom(
        new BorrowPositionKey({ marketId: market.id, scope: walletScope })
      )
    );

    expect(AsyncResult.getOrThrow(list).items[0]?.id).toBe(market.id);
    expect(AsyncResult.getOrThrow(detail).id).toBe(market.id);
    expect(getIntegrations).toHaveBeenCalledOnce();
    expect(getMarkets).toHaveBeenCalledOnce();
    expect(getPositionData).toHaveBeenCalledOnce();
  });

  it("shares positions when only unused additional addresses differ", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
      positionDto
    );
    const getPositionData = vi.fn(() =>
      Effect.succeed([{ integration, position }])
    );
    const registry = makeRegistry({
      getIntegrations: () => Effect.succeed([integration]),
      getMarkets: () =>
        Effect.succeed({
          items: [market],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      getPositionData,
    });
    const scopeWithAdditionalAddress = new WalletScopeKey({
      additionalAddresses: { binanceBeaconAddress: "bnb-address" },
      address,
      network: "ethereum",
    });
    const first = borrowPositionsAtom(
      new BorrowPositionsKey({ scope: walletScope })
    );
    const second = borrowPositionsAtom(
      new BorrowPositionsKey({ scope: scopeWithAdditionalAddress })
    );

    expect(second).toBe(first);
    expect(AsyncResult.getOrThrow(registry.get(first)).items).toHaveLength(1);
    expect(AsyncResult.getOrThrow(registry.get(second)).items).toHaveLength(1);
    expect(getPositionData).toHaveBeenCalledOnce();
  });

  it("loads complete market pages and keeps network identities separate", () => {
    const ethereumMarket = Schema.decodeUnknownSync(Market)(marketDto);
    const baseMarket = Schema.decodeUnknownSync(Market)({
      ...marketDto,
      id: "aave-v3-base-usdc",
      network: "base",
    });
    const getMarkets = vi.fn(
      ({
        network,
        offset,
      }: {
        network: "base" | "ethereum";
        offset: number;
      }) => {
        const getItems = () => {
          if (network === "base") return [baseMarket];
          if (offset !== 0) {
            return [
              Schema.decodeUnknownSync(Market)({
                ...marketDto,
                id: "aave-v3-ethereum-usdt",
              }),
            ];
          }
          return [ethereumMarket];
        };
        const items = getItems();

        return Effect.succeed({
          items,
          limit: 100,
          offset,
          total: network === "base" ? 1 : 101,
        });
      }
    );
    const registry = makeRegistry({ getMarkets });
    const ethereum = borrowMarketsAtom(
      new BorrowMarketsKey({ network: "ethereum" })
    );
    const equivalentEthereum = borrowMarketsAtom(
      new BorrowMarketsKey({ network: "ethereum" })
    );
    const base = borrowMarketsAtom(new BorrowMarketsKey({ network: "base" }));

    expect(AsyncResult.getOrThrow(registry.get(ethereum))).toHaveLength(2);
    expect(
      AsyncResult.getOrThrow(registry.get(equivalentEthereum))
    ).toHaveLength(2);
    expect(AsyncResult.getOrThrow(registry.get(base))).toEqual([baseMarket]);
    expect(getMarkets.mock.calls.map(([request]) => request)).toEqual([
      { limit: 100, network: "ethereum", offset: 0, scope: "all" },
      { limit: 100, network: "ethereum", offset: 100, scope: "all" },
      { limit: 100, network: "base", offset: 0, scope: "all" },
    ]);
  });

  it("preserves base previous values and errors while typing absent details", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const accountPosition = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
      positionDto
    );
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        { accountSnapshot: accountPosition, integration },
      ],
      markets: [market],
    });
    const base = borrowPositionsAtom(
      new BorrowPositionsKey({ scope: walletScope })
    );
    const detail = borrowPositionAtom(
      new BorrowPositionKey({ marketId: market.id, scope: walletScope })
    );
    const waitingRegistry = AtomRegistry.make({
      initialValues: [
        [base, AsyncResult.waiting(AsyncResult.success(positions))],
      ],
    });
    const waiting = waitingRegistry.get(detail);

    expect(waiting.waiting).toBe(true);
    expect(AsyncResult.getOrThrow(waiting).id).toBe(market.id);

    const error = new BorrowAtomError({
      cause: new ApiRequestError({
        cause: new Error("refresh failed"),
        operation: "borrow-positions",
      }),
      operation: "borrow-positions",
    });
    const failureRegistry = AtomRegistry.make({
      initialValues: [
        [
          base,
          AsyncResult.failWithPrevious(error, {
            previous: Option.some(AsyncResult.success(positions)),
            waiting: false,
          }),
        ],
      ],
    });
    const failure = failureRegistry.get(detail);

    expect(AsyncResult.isFailure(failure)).toBe(true);
    expect(Option.getOrThrow(AsyncResult.value(failure)).id).toBe(market.id);
    if (!AsyncResult.isFailure(failure)) throw new Error("Expected failure");
    expect(Option.getOrThrow(Cause.findErrorOption(failure.cause))).toBe(error);

    const absentRegistry = AtomRegistry.make({
      initialValues: [[base, AsyncResult.success(emptyBorrowPositions)]],
    });
    const absent = absentRegistry.get(detail);

    expect(AsyncResult.isFailure(absent)).toBe(true);
    if (!AsyncResult.isFailure(absent)) throw new Error("Expected failure");
    expect(Option.getOrThrow(Cause.findErrorOption(absent.cause))).toEqual(
      new BorrowPositionNotFound({ marketId: market.id })
    );
  });

  it("wraps borrow API failures in AsyncResult failure state", () => {
    const registry = makeRegistry({
      getIntegrations: () => Effect.fail(new Error("borrow unavailable")),
    });
    const result = registry.get(borrowIntegrationsAtom);

    expect(AsyncResult.isFailure(result)).toBe(true);
    if (AsyncResult.isFailure(result)) {
      const error = Cause.findErrorOption(result.cause);

      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(BorrowAtomError);
        expect("operation" in error.value).toBe(true);
        if ("operation" in error.value) {
          expect(error.value.operation).toBe("borrow-integrations");
        }
      }
    }
  });
});
