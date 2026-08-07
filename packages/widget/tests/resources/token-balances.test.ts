import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { ApiRequestError } from "../../src/domain/schema/api-errors";
import type { TokenBalanceScanCommand } from "../../src/domain/schema/financial-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import { tokenBalancesScanAtom as portfolioTokenBalancesAtom } from "../../src/features/portfolio/state";
import {
  refreshTokenBalancesAtom,
  TokenBalancesError,
  tokenBalancesResourceAtom,
} from "../../src/resources/token-balances/token-balances";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

const makeScope = (input?: {
  readonly address?: typeof address;
  readonly network?: "base" | "ethereum";
}) =>
  new WalletScopeKey({
    additionalAddresses: {
      lidoStakeAccounts: [],
      stakeAccounts: ["stake-account", "stake-account"],
    },
    address: input?.address ?? address,
    network: input?.network ?? "ethereum",
  });

const makeRegistry = (source: LegacyResourceSource["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.succeed(LegacyResourceSource, source)
      ),
    ],
  });

describe("Token Balances resource", () => {
  it("shares one acquisition for equivalent Wallet Scope requests", () => {
    const scanTokenBalances = vi.fn(() => Effect.succeed([]));
    const registry = makeRegistry(
      LegacyResourceSource.of({ scanTokenBalances } as never)
    );

    expect(
      AsyncResult.getOrThrow(
        registry.get(tokenBalancesResourceAtom(makeScope()))
      )
    ).toEqual([]);
    expect(
      AsyncResult.getOrThrow(
        registry.get(tokenBalancesResourceAtom(makeScope()))
      )
    ).toEqual([]);
    expect(scanTokenBalances).toHaveBeenCalledOnce();
    expect(scanTokenBalances).toHaveBeenCalledWith({
      addresses: {
        additionalAddresses: {
          lidoStakeAccounts: [],
          stakeAccounts: ["stake-account"],
        },
        address,
      },
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

  it("keeps distinct Wallet Scope identities in separate resources", () => {
    const otherAddress = Schema.decodeSync(WalletAddress)(
      "0x0000000000000000000000000000000000000002"
    );
    const scanTokenBalances = vi.fn((_command: TokenBalanceScanCommand) =>
      Effect.succeed([])
    );
    const registry = makeRegistry(
      LegacyResourceSource.of({ scanTokenBalances } as never)
    );

    registry.get(tokenBalancesResourceAtom(makeScope()));
    registry.get(
      tokenBalancesResourceAtom(
        makeScope({ address: otherAddress, network: "base" })
      )
    );

    expect(scanTokenBalances).toHaveBeenCalledTimes(2);
    expect(
      scanTokenBalances.mock.calls.map(([command]) => ({
        address: command.addresses.address,
        network: command.network,
      }))
    ).toEqual([
      { address, network: "ethereum" },
      { address: otherAddress, network: "base" },
    ]);
  });

  it("starts with a fresh cache in a new Widget Instance registry", () => {
    const scanTokenBalances = vi.fn(() => Effect.succeed([]));
    const source = LegacyResourceSource.of({ scanTokenBalances } as never);
    const resource = tokenBalancesResourceAtom(makeScope());
    const firstRegistry = makeRegistry(source);

    expect(AsyncResult.getOrThrow(firstRegistry.get(resource))).toEqual([]);
    firstRegistry.dispose();

    const secondRegistry = makeRegistry(source);
    expect(AsyncResult.getOrThrow(secondRegistry.get(resource))).toEqual([]);
    expect(scanTokenBalances).toHaveBeenCalledTimes(2);
    secondRegistry.dispose();
  });
});
