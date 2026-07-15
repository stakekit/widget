import { Effect, Stream } from "effect";
import type { Chain } from "viem";
import { mainnet, optimism } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { makeConnectorChainsStream } from "../../src/features/wallet/state/connector-chains";
import { makeCurrentValueStream } from "../../src/shared/effect/current-value-stream";

describe("connector chains atom", () => {
  it("uses configured EVM chains when the connector has no filtered source", async () => {
    const values = await Effect.runPromise(
      makeConnectorChainsStream({
        connector: undefined,
        defaultEvmChains: [mainnet],
      }).pipe(Stream.runCollect)
    );

    expect(Array.from(values)).toEqual([[mainnet]]);
  });

  it("streams filtered chains, deduplicates values, and unsubscribes", async () => {
    const filteredChains = makeCurrentValueStream<Chain[]>([mainnet]);
    const connector = {
      $filteredChains: filteredChains.changes,
      id: "filtered",
    } as unknown as Connector;
    const valuesPromise = Effect.runPromise(
      makeConnectorChainsStream({
        connector,
        defaultEvmChains: [optimism],
      }).pipe(Stream.take(2), Stream.runCollect)
    );

    await vi.waitFor(() => {
      expect(filteredChains.subscriberCount()).toBe(1);
    });
    filteredChains.set([mainnet]);
    filteredChains.set([optimism]);

    expect(Array.from(await valuesPromise)).toEqual([[mainnet], [optimism]]);
    expect(filteredChains.subscriberCount()).toBe(0);
  });
});
