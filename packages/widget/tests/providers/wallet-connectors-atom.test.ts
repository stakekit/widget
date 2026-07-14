import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import type { Config, Connector } from "wagmi";
import {
  disconnectedWalletConnectors,
  makeWagmiConnectorsStream,
  makeWalletConnectorsAtom,
  type WalletConnectorsOperations,
  type WalletConnectorsSnapshot,
} from "../../src/providers/wallet/state/connectors";

describe("wallet connectors atom", () => {
  it("registers the watch before seeding, deduplicates, and finalizes", async () => {
    const firstConnector = { id: "first" } as Connector;
    const secondConnector = { id: "second" } as Connector;
    const order: string[] = [];
    const unsubscribe = vi.fn();
    let onChange: (snapshot: WalletConnectorsSnapshot) => void = () => {};
    const operations: WalletConnectorsOperations = {
      get: () => {
        order.push("get");
        return disconnectedWalletConnectors;
      },
      watch: (_config, callback) => {
        order.push("watch");
        onChange = callback;
        return unsubscribe;
      },
    };
    const valuesPromise = Effect.runPromise(
      makeWagmiConnectorsStream({} as Config, operations).pipe(
        Stream.take(3),
        Stream.runCollect
      )
    );

    await vi.waitFor(() => {
      expect(order).toEqual(["watch", "get"]);
    });
    onChange([firstConnector]);
    onChange([firstConnector]);
    onChange([secondConnector]);

    expect(Array.from(await valuesPromise)).toEqual([
      disconnectedWalletConnectors,
      [firstConnector],
      [secondConnector],
    ]);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("publishes an empty connector list before a controller is ready", () => {
    const controllerAtom = Atom.make(
      AsyncResult.initial<{ readonly wagmiConfig: Config }, never>()
    );
    const registry = AtomRegistry.make();
    const result = registry.get(makeWalletConnectorsAtom(controllerAtom));

    expect(AsyncResult.isSuccess(result)).toBe(true);
    if (AsyncResult.isSuccess(result)) {
      expect(result.value).toEqual(disconnectedWalletConnectors);
    }

    registry.dispose();
  });
});
