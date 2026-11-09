import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vitest";

import {
  deriveBorrowPositions,
  emptyBorrowPositions,
} from "../../../../src/domain/borrow/borrow-positions";
import { WalletAddress } from "../../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../../src/domain/wallet/wallet-scope";
import {
  BorrowPositionKey,
  borrowPositionAtom,
  currentBorrowPositionsAtom,
} from "../../../../src/features/borrow/positions/state/positions";
import { walletScopeAtom } from "../../../../src/features/wallet/index";
import { borrowIntegrationsResourceAtom as borrowIntegrationsAtom } from "../../../../src/resources/borrow-integrations/borrow-integrations";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom as borrowMarketsAtom,
} from "../../../../src/resources/borrow-markets/borrow-markets";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom as borrowPositionsAtom,
} from "../../../../src/resources/borrow-positions/borrow-positions";
import { BorrowResourceError as BorrowAtomError } from "../../../../src/resources/borrow-resource-error";
import { appRuntime } from "../../../../src/runtime/app-runtime";
import { makeBorrowResourceSource } from "../../../../src/services/api/internal/borrow-resource-source";
import {
  ApiRequestError,
  BorrowResourceSource,
} from "../../../../src/services/api/resource-sources";
import {
  borrowWalletAddress,
  makeBorrowAccountSnapshot,
  makeBorrowIntegration,
  makeBorrowMarket,
} from "../../../fixtures/borrow";
import { unconfiguredBorrowResourceSourceLayer } from "../../../utils/services/borrow-resource-source";
import { applicationRuntimeInitInitialValue } from "../../../utils/widget-config";

const address = Schema.decodeSync(WalletAddress)(borrowWalletAddress);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});

type BorrowResourceSourceService = BorrowResourceSource["Service"];
type BorrowMarketsRequest = Parameters<
  BorrowResourceSourceService["getMarkets"]
>[0];

/** Borrow reads answered by `overrides`; every other read stays unconfigured. */
const borrowResourceSourceLayer = (
  overrides: Partial<BorrowResourceSourceService>
) =>
  Layer.effect(
    BorrowResourceSource,
    Effect.gen(function* () {
      const unconfigured = yield* BorrowResourceSource;
      return BorrowResourceSource.of({ ...unconfigured, ...overrides });
    })
  ).pipe(Layer.provide(unconfiguredBorrowResourceSourceLayer));

const makeRegistry = (overrides: Partial<BorrowResourceSourceService>) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(appRuntime.layer, borrowResourceSourceLayer(overrides)),
    ],
  });

const borrowUnavailable = (operation: string) =>
  new ApiRequestError({
    cause: new Error("borrow unavailable"),
    failure: { _tag: "Unreachable" },
    operation,
  });

describe("Borrow Positions resource atoms", () => {
  it("keeps positions in markets outside the enabled catalog visible", () => {
    const integration = makeBorrowIntegration();
    const market = makeBorrowMarket();
    const position = makeBorrowAccountSnapshot();
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          borrowResourceSourceLayer({
            getIntegrations: Effect.succeed([integration]),
            getMarkets: (request: BorrowMarketsRequest) => {
              const items = request.scope === "all" ? [market] : [];
              return Effect.succeed({
                items,
                limit: 100,
                offset: 0,
                total: items.length,
              });
            },
            getPositionData: () => Effect.succeed([{ integration, position }]),
          })
        ),
        Atom.initialValue(walletScopeAtom, walletScope),
        applicationRuntimeInitInitialValue({
          apiKey: "api-key",
          borrowEnabled: true,
          borrowMarketsScope: "enabled",
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
          borrowMarketsAtom(
            new BorrowMarketsKey({ network: "ethereum", scope: "all" })
          )
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
    const integration = makeBorrowIntegration();
    const market = makeBorrowMarket();
    const position = makeBorrowAccountSnapshot();
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
      getIntegrations: Effect.suspend(getIntegrations),
      getMarkets,
      getPositionData,
    });

    expect(
      AsyncResult.getOrThrow(registry.get(borrowIntegrationsAtom))
    ).toHaveLength(1);
    expect(
      AsyncResult.getOrThrow(
        registry.get(
          borrowMarketsAtom(
            new BorrowMarketsKey({ network: "ethereum", scope: "all" })
          )
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
    expect(AsyncResult.getOrThrow(detail)?.id).toBe(market.id);
    expect(getIntegrations).toHaveBeenCalledOnce();
    expect(getMarkets).toHaveBeenCalledOnce();
    expect(getPositionData).toHaveBeenCalledOnce();
  });

  it("shares positions when only unused additional addresses differ", () => {
    const integration = makeBorrowIntegration();
    const market = makeBorrowMarket();
    const position = makeBorrowAccountSnapshot();
    const getPositionData = vi.fn(() =>
      Effect.succeed([{ integration, position }])
    );
    const registry = makeRegistry({
      getIntegrations: Effect.succeed([integration]),
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
    const ethereumMarket = makeBorrowMarket();
    const baseMarket = makeBorrowMarket({
      id: "aave-v3-base-usdc",
      network: "base",
    });
    const getMarkets = vi.fn(({ network, offset }: BorrowMarketsRequest) => {
      const getItems = () => {
        if (network === "base") return [baseMarket];
        if (offset !== 0) {
          return [makeBorrowMarket({ id: "aave-v3-ethereum-usdt" })];
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
    });
    const registry = makeRegistry({ getMarkets });
    const ethereum = borrowMarketsAtom(
      new BorrowMarketsKey({ network: "ethereum", scope: "all" })
    );
    const equivalentEthereum = borrowMarketsAtom(
      new BorrowMarketsKey({ network: "ethereum", scope: "all" })
    );
    const base = borrowMarketsAtom(
      new BorrowMarketsKey({ network: "base", scope: "all" })
    );

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
    const integration = makeBorrowIntegration();
    const market = makeBorrowMarket();
    const accountPosition = makeBorrowAccountSnapshot();
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
    expect(AsyncResult.getOrThrow(waiting)?.id).toBe(market.id);

    const error = new BorrowAtomError({
      cause: new ApiRequestError({
        cause: new Error("refresh failed"),
        failure: { _tag: "Unreachable" },
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
    expect(Option.getOrThrow(AsyncResult.value(failure))?.id).toBe(market.id);
    if (!AsyncResult.isFailure(failure)) throw new Error("Expected failure");
    expect(Option.getOrThrow(Cause.findErrorOption(failure.cause))).toBe(error);

    const absentRegistry = AtomRegistry.make({
      initialValues: [[base, AsyncResult.success(emptyBorrowPositions)]],
    });
    const absent = absentRegistry.get(detail);

    expect(AsyncResult.isSuccess(absent)).toBe(true);
    expect(AsyncResult.getOrThrow(absent)).toBeNull();
  });

  it("wraps borrow API failures in AsyncResult failure state", () => {
    const registry = makeRegistry({
      getIntegrations: Effect.fail(borrowUnavailable("borrow-integrations")),
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

  it("keeps the last positions when a positions refetch fails", () => {
    const integration = makeBorrowIntegration();
    const market = makeBorrowMarket();
    const position = makeBorrowAccountSnapshot();
    let offline = false;
    const registry = makeRegistry({
      getIntegrations: Effect.succeed([integration]),
      getMarkets: () =>
        Effect.succeed({ items: [market], limit: 100, offset: 0, total: 1 }),
      getPositionData: () =>
        offline
          ? Effect.fail(borrowUnavailable("borrow-positions"))
          : Effect.succeed([{ integration, position }]),
    });
    const positions = borrowPositionsAtom(
      new BorrowPositionsKey({ scope: walletScope })
    );
    const unmount = registry.mount(positions);

    try {
      expect(
        AsyncResult.getOrThrow(registry.get(positions)).items
      ).toHaveLength(1);

      offline = true;
      registry.refresh(positions);
      const refetched = registry.get(positions);

      expect(AsyncResult.isFailure(refetched)).toBe(true);
      expect(
        refetched.pipe(AsyncResult.value, Option.getOrThrow).items[0]?.id
      ).toBe(market.id);
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
