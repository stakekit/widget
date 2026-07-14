import type { ChainWalletBase } from "@cosmos-kit/core";
import { Effect, Stream } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { makeCurrentValueStream } from "../../src/common/current-value-stream";
import {
  disconnectedCosmosChainWallet,
  makeCosmosChainWalletStream,
} from "../../src/providers/wallet/state/cosmos";

describe("Cosmos chain-wallet atom", () => {
  it("uses a deterministic null value for non-Cosmos connectors", async () => {
    const values = await Effect.runPromise(
      makeCosmosChainWalletStream(undefined).pipe(Stream.runCollect)
    );

    expect(Array.from(values)).toEqual([disconnectedCosmosChainWallet]);
  });

  it("streams chain-wallet changes, deduplicates, and unsubscribes", async () => {
    const firstWallet = {
      address: "cosmos1first",
      chainId: "cosmoshub-4",
    } as ChainWalletBase;
    const replacementWallet = {
      address: "cosmos1replacement",
      chainId: "cosmoshub-4",
    } as ChainWalletBase;
    const chainWallet = makeCurrentValueStream(firstWallet);
    const connector = {
      $chainWallet: chainWallet.changes,
      type: "cosmosProvider",
    } as unknown as Connector;
    const valuesPromise = Effect.runPromise(
      makeCosmosChainWalletStream(connector).pipe(
        Stream.take(2),
        Stream.runCollect
      )
    );

    await vi.waitFor(() => {
      expect(chainWallet.subscriberCount()).toBe(1);
    });
    chainWallet.set(firstWallet);
    chainWallet.set(replacementWallet);

    expect(Array.from(await valuesPromise)).toEqual([
      firstWallet,
      replacementWallet,
    ]);
    expect(chainWallet.subscriberCount()).toBe(0);
  });
});
