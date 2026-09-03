import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  GasTokenBalancesKey,
  gasTokenBalancesResourceAtom,
} from "../../src/resources/gas-token-balances/gas-token-balances";
import {
  SingleYieldBalancesError,
  SingleYieldBalancesKey,
  singleYieldBalancesResourceAtom,
} from "../../src/resources/single-yield-balances/single-yield-balances";
import {
  ApiRequestError,
  LegacyResourceSource,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import { yieldApiYieldFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const scope = new WalletScopeKey({ address, network: "ethereum" });
const yieldId = yieldApiYieldFixture().id;
const singleKey = () =>
  new SingleYieldBalancesKey({ address: scope.address, yieldId });
const gasKey = () =>
  new GasTokenBalancesKey({
    command: { addresses: [{ address, network: "ethereum" }] },
  });

const makeRegistry = (layer: Layer.Layer<never>) =>
  AtomRegistry.make({
    initialValues: [Atom.initialValue(appRuntime.layer, layer)],
  });

describe("flow balance fact resources", () => {
  it("shares equivalent single-Yield and gas-balance requests", () => {
    const getSingleYieldBalances = vi.fn(() =>
      Effect.succeed({ balances: [] })
    );
    const getGasTokenBalances = vi.fn(() => Effect.succeed([]));
    const registry = makeRegistry(
      Layer.mergeAll(
        Layer.succeed(YieldResourceSource, {
          getSingleYieldBalances,
        } as never),
        Layer.succeed(LegacyResourceSource, { getGasTokenBalances } as never)
      ) as never
    );

    registry.get(singleYieldBalancesResourceAtom(singleKey()));
    registry.get(singleYieldBalancesResourceAtom(singleKey()));
    registry.get(gasTokenBalancesResourceAtom(gasKey()));
    registry.get(gasTokenBalancesResourceAtom(gasKey()));

    expect(getSingleYieldBalances).toHaveBeenCalledOnce();
    expect(getGasTokenBalances).toHaveBeenCalledOnce();
  });

  it("keeps distinct wallets and commands in separate facts", () => {
    const otherAddress = Schema.decodeSync(WalletAddress)(
      "0x0000000000000000000000000000000000000002"
    );
    const getSingleYieldBalances = vi.fn(() =>
      Effect.succeed({ balances: [] })
    );
    const getGasTokenBalances = vi.fn(() => Effect.succeed([]));
    const registry = makeRegistry(
      Layer.mergeAll(
        Layer.succeed(YieldResourceSource, {
          getSingleYieldBalances,
        } as never),
        Layer.succeed(LegacyResourceSource, { getGasTokenBalances } as never)
      ) as never
    );

    registry.get(singleYieldBalancesResourceAtom(singleKey()));
    registry.get(
      singleYieldBalancesResourceAtom(
        new SingleYieldBalancesKey({
          address: otherAddress,
          yieldId,
        })
      )
    );
    registry.get(gasTokenBalancesResourceAtom(gasKey()));
    registry.get(
      gasTokenBalancesResourceAtom(
        new GasTokenBalancesKey({
          command: {
            addresses: [{ address: otherAddress, network: "base" }],
          },
        })
      )
    );

    expect(getSingleYieldBalances).toHaveBeenCalledTimes(2);
    expect(getGasTokenBalances).toHaveBeenCalledTimes(2);
  });

  it("publishes typed failure, retries, and scopes cache to the registry", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      operation: "single-yield-balances",
    });
    const getSingleYieldBalances = vi.fn(() =>
      offline ? Effect.fail(requestError) : Effect.succeed({ balances: [] })
    );
    const layer = Layer.succeed(YieldResourceSource, {
      getSingleYieldBalances,
    } as never) as never;
    const registry = makeRegistry(layer);
    const key = singleKey();
    const resource = singleYieldBalancesResourceAtom(key);
    const failed = registry.get(resource);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    expect(
      Option.getOrThrow(Cause.findErrorOption(failed.cause))
    ).toBeInstanceOf(SingleYieldBalancesError);

    const attemptsBeforeRetry = getSingleYieldBalances.mock.calls.length;
    offline = false;
    registry.refresh(resource);
    expect(AsyncResult.getOrThrow(registry.get(resource)).balances).toEqual([]);
    expect(getSingleYieldBalances).toHaveBeenCalledTimes(
      attemptsBeforeRetry + 1
    );
    registry.dispose();

    const nextRegistry = makeRegistry(layer);
    nextRegistry.get(resource);
    expect(getSingleYieldBalances).toHaveBeenCalledTimes(
      attemptsBeforeRetry + 2
    );
    nextRegistry.dispose();
  });
});
