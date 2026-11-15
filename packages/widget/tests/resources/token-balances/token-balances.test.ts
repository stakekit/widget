import { describe, expect, it, vi } from "@effect/vitest";
import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

import type { TokenBalanceScanCommand } from "../../../src/domain/finance/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { tokenBalancesScanAtom as portfolioTokenBalancesAtom } from "../../../src/features/portfolio/state/read-models/token-balances";
import {
  refreshTokenBalancesAtom,
  TokenBalancesError,
  tokenBalancesResourceAtom,
} from "../../../src/resources/token-balances/token-balances";
import { appRuntime } from "../../../src/runtime/app-runtime";
import {
  ApiRequestError,
  LegacyResourceSource,
} from "../../../src/services/api/resource-sources";
import { readCountsAcrossHiddenPage } from "../../utils/services/page-visibility";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

const makeScope = () =>
  new WalletScopeKey({
    additionalAddresses: {
      lidoStakeAccounts: [],
      stakeAccounts: ["stake-account", "stake-account"],
    },
    address,
    network: "ethereum",
  });

const makeRegistry = (
  source: LegacyResourceSource["Service"],
  initialValues: ReadonlyArray<readonly [Atom.Atom<unknown>, unknown]> = []
) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(LegacyResourceSource, source)
      ),
      ...initialValues,
    ],
  });

describe("Token Balances resource", () => {
  it("shares one request across additional addresses and EVM address casing", () => {
    const checksumAddress = Schema.decodeSync(WalletAddress)(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    );
    const lowercaseAddress = Schema.decodeSync(WalletAddress)(
      checksumAddress.toLowerCase()
    );
    const scanTokenBalances = vi.fn((_command: TokenBalanceScanCommand) =>
      Effect.succeed([])
    );
    const registry = makeRegistry(
      LegacyResourceSource.of({ scanTokenBalances } as never)
    );
    const checksumScope = new WalletScopeKey({
      additionalAddresses: { binanceBeaconAddress: "bnb-address" },
      address: checksumAddress,
      network: "ethereum",
    });
    const lowercaseScope = new WalletScopeKey({
      address: lowercaseAddress,
      network: "ethereum",
    });

    registry.get(tokenBalancesResourceAtom(checksumScope));
    registry.get(tokenBalancesResourceAtom(lowercaseScope));
    registry.set(refreshTokenBalancesAtom(lowercaseScope), undefined);
    registry.get(tokenBalancesResourceAtom(checksumScope));

    expect(scanTokenBalances).toHaveBeenCalledTimes(2);
    expect(scanTokenBalances).toHaveBeenNthCalledWith(1, {
      address: lowercaseAddress,
      network: "ethereum",
    });
  });

  it("does not acquire balances while the current wallet scope is empty", () => {
    const scanTokenBalances = vi.fn(() => Effect.succeed([]));
    const registry = makeRegistry(
      LegacyResourceSource.of({ scanTokenBalances } as never)
    );

    const state = registry.get(portfolioTokenBalancesAtom);

    expect(state.enabled).toBe(false);
    expect(AsyncResult.getOrThrow(state.result)).toEqual([]);
    expect(scanTokenBalances).not.toHaveBeenCalled();
  });

  it("publishes typed failures and recovers after retry", () => {
    let offline = true;
    const requestError = new ApiRequestError({
      cause: new Error("offline"),
      failure: { _tag: "Unreachable" },
      operation: "token-balances-scan",
    });
    const scanTokenBalances = vi.fn((_command: TokenBalanceScanCommand) =>
      offline ? Effect.fail(requestError) : Effect.succeed([])
    );
    const registry = makeRegistry(
      LegacyResourceSource.of({ scanTokenBalances } as never)
    );
    const scope = makeScope();
    const resource = tokenBalancesResourceAtom(scope);
    const failed = registry.get(resource);

    expect(AsyncResult.isFailure(failed)).toBe(true);
    if (!AsyncResult.isFailure(failed)) throw new Error("Expected failure");
    const error = Option.getOrThrow(Cause.findErrorOption(failed.cause));
    expect(error).toBeInstanceOf(TokenBalancesError);
    expect(error.cause).toBe(requestError);

    const attemptsBeforeRetry = scanTokenBalances.mock.calls.length;
    offline = false;
    registry.set(refreshTokenBalancesAtom(scope), undefined);

    expect(AsyncResult.getOrThrow(registry.get(resource))).toEqual([]);
    expect(scanTokenBalances).toHaveBeenCalledTimes(attemptsBeforeRetry + 1);
  });

  it.effect(
    "skips scheduled scans while the page is hidden and scans once when it is shown",
    () => {
      const scanTokenBalances = vi.fn((_command: TokenBalanceScanCommand) =>
        Effect.succeed([])
      );
      return readCountsAcrossHiddenPage({
        mount: (pageVisibility) => {
          const registry = makeRegistry(
            LegacyResourceSource.of({ scanTokenBalances } as never),
            [pageVisibility]
          );
          registry.mount(tokenBalancesResourceAtom(makeScope()));
          return registry;
        },
        periodSeconds: 60,
        readCount: () => scanTokenBalances.mock.calls.length,
      }).pipe(
        Effect.map((readCounts) => {
          expect(readCounts).toEqual([1, 2, 2, 3, 3, 4]);
        })
      );
    }
  );
});
