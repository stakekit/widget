import { describe, expect, it, vi } from "@effect/vitest";
import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

import { EarnPosition } from "../../../src/domain/earn/balance";
import type { YieldBalancesCommand } from "../../../src/domain/finance/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { positionsDataAtom as earnPositionsDataAtom } from "../../../src/features/earn/state/earn-selection/catalog/catalog";
import { PositionsDataKey } from "../../../src/features/earn/state/earn-selection/catalog/keys";
import {
  PositionBalancesKey,
  PositionDataKey,
  positionBalancesAtom,
  positionDataAtom,
  refreshYieldPositionsAtom,
  YieldPositionsError,
  yieldPositionsResourceAtom,
} from "../../../src/resources/yield-positions/yield-positions";
import { appRuntime } from "../../../src/runtime/app-runtime";
import {
  ApiRequestError,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../../fixtures";
import { readCountsAcrossHiddenPage } from "../../utils/services/page-visibility";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

const makeScope = () =>
  new WalletScopeKey({
    address,
    network: "ethereum",
  });

const makePosition = (amount = "2") => {
  const yieldDto = yieldApiYieldFixture();

  return Schema.decodeSync(EarnPosition)({
    balances: [
      yieldBalanceFixture({
        amount,
        amountUsd: amount,
        type: "active",
        token: yieldDto.token,
      }),
    ],
    outputTokenBalance: null,
    yieldId: yieldDto.id,
  });
};

const makeRegistry = (
  source: YieldResourceSource["Service"],
  initialValues: ReadonlyArray<readonly [Atom.Atom<unknown>, unknown]> = []
) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(YieldResourceSource, source)
      ),
      ...initialValues,
    ],
  });

describe("Yield Positions resource", () => {
  it("ignores additional addresses that do not affect the request", () => {
    const getPositions = vi.fn((_command: YieldBalancesCommand) =>
      Effect.succeed({ errors: [], items: [makePosition()] })
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ getPositions } as never)
    );
    const baseScope = makeScope();
    const scopeWithAdditionalAddress = new WalletScopeKey({
      additionalAddresses: { binanceBeaconAddress: "bnb-address" },
      address,
      network: "ethereum",
    });

    const first = yieldPositionsResourceAtom(baseScope);
    const second = yieldPositionsResourceAtom(scopeWithAdditionalAddress);

    expect(second).toBe(first);
    expect(AsyncResult.getOrThrow(registry.get(first)).items).toHaveLength(1);
    expect(AsyncResult.getOrThrow(registry.get(second)).items).toHaveLength(1);
    expect(getPositions).toHaveBeenCalledOnce();
  });

  it("shares EVM owner requests across equivalent address casing", () => {
    const checksumAddress = Schema.decodeSync(WalletAddress)(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    );
    const lowercaseAddress = Schema.decodeSync(WalletAddress)(
      checksumAddress.toLowerCase()
    );
    const getPositions = vi.fn((_command: YieldBalancesCommand) =>
      Effect.succeed({ errors: [], items: [makePosition()] })
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ getPositions } as never)
    );
    const checksumScope = new WalletScopeKey({
      address: checksumAddress,
      network: "ethereum",
    });
    const lowercaseScope = new WalletScopeKey({
      address: lowercaseAddress,
      network: "ethereum",
    });

    const first = yieldPositionsResourceAtom(checksumScope);
    const second = yieldPositionsResourceAtom(lowercaseScope);

    expect(second).toBe(first);
    registry.get(first);
    registry.get(second);
    expect(getPositions).toHaveBeenCalledOnce();
    expect(getPositions.mock.calls[0]?.[0].queries[0]?.address).toBe(
      lowercaseAddress
    );
  });

  it("shares one acquisition between Earn and Portfolio projections", () => {
    const position = makePosition();
    const getPositions = vi.fn(() =>
      Effect.succeed({ errors: [], items: [position] })
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ getPositions } as never)
    );
    const scope = makeScope();

    const earnPositions = registry.get(
      earnPositionsDataAtom(new PositionsDataKey({ scope }))
    );
    const portfolioPosition = registry.get(
      positionDataAtom(
        new PositionDataKey({
          scope,
          yieldId: position.yieldId,
        })
      )
    );

    expect(AsyncResult.getOrThrow(earnPositions).size).toBe(1);
    expect(AsyncResult.getOrThrow(portfolioPosition)?.yieldId).toBe(
      position.yieldId
    );
    expect(getPositions).toHaveBeenCalledOnce();
  });

  it("publishes a stable failure and recovers when the resource is retried", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      failure: { _tag: "Unreachable" },
      operation: "yield-positions",
    });
    const getPositions = vi.fn(() => {
      return offline
        ? Effect.fail(requestError)
        : Effect.succeed({ errors: [], items: [makePosition()] });
    });
    const registry = makeRegistry(
      YieldResourceSource.of({ getPositions } as never)
    );
    const resource = yieldPositionsResourceAtom(makeScope());
    const failed = registry.get(resource);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    const error = Option.getOrThrow(Cause.findErrorOption(failed.cause));
    expect(error).toBeInstanceOf(YieldPositionsError);
    expect(error.cause).toBe(requestError);

    const attemptsBeforeRetry = getPositions.mock.calls.length;
    offline = false;
    registry.set(refreshYieldPositionsAtom(makeScope()), undefined);

    expect(AsyncResult.getOrThrow(registry.get(resource)).items).toHaveLength(
      1
    );
    expect(getPositions).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
  });

  it("keeps distinct Wallet Scope identities in separate resources", () => {
    const otherAddress = Schema.decodeSync(WalletAddress)(
      "0x0000000000000000000000000000000000000002"
    );
    const getPositions = vi.fn((_command: YieldBalancesCommand) =>
      Effect.succeed({ errors: [], items: [makePosition()] })
    );
    const registry = makeRegistry(
      YieldResourceSource.of({ getPositions } as never)
    );

    registry.get(yieldPositionsResourceAtom(makeScope()));
    registry.get(
      yieldPositionsResourceAtom(
        new WalletScopeKey({ address: otherAddress, network: "base" })
      )
    );

    expect(getPositions).toHaveBeenCalledTimes(2);
    expect(
      getPositions.mock.calls.map(([command]) => command.queries[0])
    ).toEqual([
      { address, network: "ethereum" },
      { address: otherAddress, network: "base" },
    ]);
  });

  it("polls while mounted and stops polling after unmount", async () => {
    vi.useFakeTimers();
    try {
      const getPositions = vi.fn(() =>
        Effect.succeed({ errors: [], items: [makePosition()] })
      );
      const registry = makeRegistry(
        YieldResourceSource.of({ getPositions } as never)
      );
      const resource = yieldPositionsResourceAtom(makeScope());
      const unmount = registry.mount(resource);

      expect(getPositions).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(60_000);
      expect(getPositions).toHaveBeenCalledTimes(2);

      unmount();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(getPositions).toHaveBeenCalledTimes(2);
      registry.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it.effect(
    "skips scheduled reads while the page is hidden and reads once when it is shown",
    () => {
      const getPositions = vi.fn(() =>
        Effect.succeed({ errors: [], items: [makePosition()] })
      );
      return readCountsAcrossHiddenPage({
        mount: (pageVisibility) => {
          const registry = makeRegistry(
            YieldResourceSource.of({ getPositions } as never),
            [pageVisibility]
          );
          registry.mount(yieldPositionsResourceAtom(makeScope()));
          return registry;
        },
        periodSeconds: 60,
        readCount: () => getPositions.mock.calls.length,
      }).pipe(
        Effect.map((readCounts) => {
          expect(readCounts).toEqual([1, 2, 2, 3, 3, 4]);
        })
      );
    }
  );

  it("resolves position balances for an explicit wallet scope", () => {
    const position = makePosition();
    const scope = makeScope();
    const balances = positionBalancesAtom(
      new PositionBalancesKey({
        balanceId: "default",
        scope,
        yieldId: position.yieldId,
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        [
          yieldPositionsResourceAtom(scope),
          AsyncResult.success({ errors: [], items: [position] }),
        ],
      ],
    });

    expect(
      Option.getOrNull(AsyncResult.value(registry.get(balances)))?.balances
    ).toHaveLength(1);
  });

  it("retains same-wallet position data only while revalidating and clears it across owners or successful absence", () => {
    const position = makePosition();
    const scopeA = makeScope();
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
