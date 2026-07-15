import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import type { Config } from "wagmi";
import {
  disconnectedWalletConnection,
  makeWagmiConnectionStream,
  makeWalletConnectionAtom,
  type WalletConnectionOperations,
  type WalletConnectionSnapshot,
} from "../../src/features/wallet/state/connection";

const connectedSnapshot = {
  ...disconnectedWalletConnection,
  address: "0x0000000000000000000000000000000000000001",
  addresses: ["0x0000000000000000000000000000000000000001"],
  chainId: 1,
  isConnected: true,
  isDisconnected: false,
  status: "connected",
} as WalletConnectionSnapshot;

describe("wallet connection atom", () => {
  it("registers the watch before seeding, deduplicates, and finalizes", async () => {
    const order: string[] = [];
    const unsubscribe = vi.fn();
    let onChange: (snapshot: WalletConnectionSnapshot) => void = () => {};
    const operations: WalletConnectionOperations = {
      get: () => {
        order.push("get");
        return disconnectedWalletConnection;
      },
      watch: (_config, callback) => {
        order.push("watch");
        onChange = callback;
        return unsubscribe;
      },
    };
    const valuesPromise = Effect.runPromise(
      makeWagmiConnectionStream({} as Config, operations).pipe(
        Stream.take(3),
        Stream.runCollect
      )
    );

    await vi.waitFor(() => {
      expect(order).toEqual(["watch", "get"]);
    });
    onChange(connectedSnapshot);
    onChange({ ...connectedSnapshot });
    onChange(disconnectedWalletConnection);

    const values = Array.from(await valuesPromise);
    expect(values).toEqual([
      disconnectedWalletConnection,
      connectedSnapshot,
      disconnectedWalletConnection,
    ]);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("publishes a deterministic disconnected value before a controller is ready", () => {
    const controllerAtom = Atom.make(
      AsyncResult.initial<{ readonly wagmiConfig: Config }, never>()
    );
    const registry = AtomRegistry.make();
    const result = registry.get(makeWalletConnectionAtom(controllerAtom));

    expect(AsyncResult.isSuccess(result)).toBe(true);
    if (AsyncResult.isSuccess(result)) {
      expect(result.value).toEqual(disconnectedWalletConnection);
    }

    registry.dispose();
  });
});
