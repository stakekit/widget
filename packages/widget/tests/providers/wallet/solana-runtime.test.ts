import {
  type Adapter,
  EventEmitter,
  type WalletAdapterEvents,
  type WalletName,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import { Connection } from "@solana/web3.js";
import { SolanaMobileWalletAdapterWalletName } from "@solana-mobile/wallet-adapter-mobile";
import type {
  Wallets,
  WalletsEventNames,
  WalletsEventsListeners,
} from "@wallet-standard/app";
import type { Wallet as StandardWallet } from "@wallet-standard/base";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  type HeadlessSolanaRuntime,
  type HeadlessSolanaRuntimeDependencies,
  makeHeadlessSolanaRuntime,
} from "../../../src/services/wallet/solana-runtime";

type FakeAdapter = Adapter & {
  readonly destroy: () => void;
  readonly destroyCount: () => number;
  readonly setReadyState: (readyState: WalletReadyState) => void;
};

const makeAdapter = (
  name: string,
  initialReadyState = WalletReadyState.NotDetected
): FakeAdapter => {
  const emitter = new EventEmitter<WalletAdapterEvents>();
  let readyState = initialReadyState;
  let destroys = 0;

  const adapter = Object.assign(emitter, {
    name: name as WalletName,
    url: `https://${name.toLowerCase()}.test`,
    icon: "data:image/svg+xml;base64,PHN2Zy8+",
    publicKey: null,
    connecting: false,
    connected: false,
    autoConnect: async () => undefined,
    connect: async () => undefined,
    disconnect: async () => undefined,
    sendTransaction: async () => "signature",
    destroy: () => {
      destroys += 1;
    },
    destroyCount: () => destroys,
    setReadyState: (nextReadyState: WalletReadyState) => {
      readyState = nextReadyState;
      emitter.emit("readyStateChange", nextReadyState);
    },
  }) as unknown as FakeAdapter;
  Object.defineProperty(adapter, "readyState", {
    configurable: true,
    get: () => readyState,
  });
  return adapter;
};

const makeStandardWallet = (name: string) =>
  ({
    accounts: [],
    chains: ["solana:mainnet"],
    features: {},
    icon: "data:image/svg+xml;base64,PHN2Zy8+",
    name,
    version: "1.0.0",
  }) as unknown as StandardWallet;

class FakeWalletRegistry implements Wallets {
  readonly #listeners = {
    register: new Set<WalletsEventsListeners["register"]>(),
    unregister: new Set<WalletsEventsListeners["unregister"]>(),
  };
  readonly #wallets = new Set<StandardWallet>();

  constructor(initialWallets: ReadonlyArray<StandardWallet> = []) {
    for (const wallet of initialWallets) this.#wallets.add(wallet);
  }

  get() {
    return [...this.#wallets];
  }

  on<E extends WalletsEventNames>(
    event: E,
    listener: WalletsEventsListeners[E]
  ) {
    const listeners = this.#listeners[event] as Set<WalletsEventsListeners[E]>;
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  register(...wallets: StandardWallet[]) {
    const registered = wallets.filter((wallet) => !this.#wallets.has(wallet));
    for (const wallet of registered) this.#wallets.add(wallet);
    if (registered.length > 0) {
      for (const listener of this.#listeners.register) {
        listener(...registered);
      }
    }

    return () => {
      const removed = registered.filter((wallet) =>
        this.#wallets.delete(wallet)
      );
      if (removed.length > 0) {
        for (const listener of this.#listeners.unregister) {
          listener(...removed);
        }
      }
    };
  }

  listenerCount(event: WalletsEventNames) {
    return this.#listeners[event].size;
  }
}

const makeDependencies = ({
  compatibleStandardWallet = () => true,
  environment = {
    appIdentityUri: "https://widget.test",
    userAgent: "desktop",
  },
  fallbacks = [],
  registry = new FakeWalletRegistry(),
}: {
  readonly compatibleStandardWallet?: (wallet: StandardWallet) => boolean;
  readonly environment?: ReturnType<
    HeadlessSolanaRuntimeDependencies["environment"]
  >;
  readonly fallbacks?: ReadonlyArray<FakeAdapter>;
  readonly registry?: FakeWalletRegistry;
} = {}) => {
  const createdConnections: Connection[] = [];
  const mobileAdapters: FakeAdapter[] = [];
  const mobileInputs: Array<
    Parameters<HeadlessSolanaRuntimeDependencies["createMobileAdapter"]>[0]
  > = [];
  const standardAdapters = new Map<StandardWallet, FakeAdapter>();
  let fallbackFactoryCalls = 0;

  const dependencies = {
    createConnection: (endpoint) => {
      const connection = new Connection(endpoint, {
        commitment: "confirmed",
      });
      createdConnections.push(connection);
      return connection;
    },
    createFallbackAdapters: () => {
      fallbackFactoryCalls += 1;
      return fallbacks;
    },
    createMobileAdapter: (input) => {
      mobileInputs.push(input);
      const adapter = makeAdapter(
        SolanaMobileWalletAdapterWalletName,
        WalletReadyState.Loadable
      );
      mobileAdapters.push(adapter);
      return adapter;
    },
    createStandardAdapter: (wallet) => {
      const adapter = Object.assign(
        makeAdapter(wallet.name, WalletReadyState.Installed),
        { standard: true as const, wallet }
      );
      standardAdapters.set(wallet, adapter);
      return adapter;
    },
    environment: () => environment,
    isCompatibleStandardWallet: compatibleStandardWallet,
    registry,
  } satisfies HeadlessSolanaRuntimeDependencies;

  return {
    createdConnections,
    dependencies,
    fallbackFactoryCalls: () => fallbackFactoryCalls,
    mobileAdapters,
    mobileInputs,
    registry,
    standardAdapters,
  };
};

const withRuntime = <A>(
  dependencies: HeadlessSolanaRuntimeDependencies,
  run: (runtime: HeadlessSolanaRuntime) => A,
  options: Parameters<typeof makeHeadlessSolanaRuntime>[0] = {}
) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const runtime = yield* makeHeadlessSolanaRuntime(options, dependencies);
        return run(runtime);
      })
    )
  );

const walletNames = (runtime: HeadlessSolanaRuntime) =>
  runtime.getWalletSnapshot().wallets.map(({ adapter }) => adapter.name);

describe("headless Solana runtime", () => {
  it("constructs one connection and discovers initial and late Standard wallets", async () => {
    const initialWallet = makeStandardWallet("Initial");
    const lateWallet = makeStandardWallet("Late");
    const setup = makeDependencies({
      fallbacks: [makeAdapter("Fallback")],
      registry: new FakeWalletRegistry([initialWallet]),
    });

    await withRuntime(
      setup.dependencies,
      (runtime) => {
        let updates = 0;
        runtime.subscribe(() => {
          updates += 1;
        });

        expect(walletNames(runtime)).toEqual(["Initial", "Fallback"]);
        setup.registry.register(lateWallet);

        expect(walletNames(runtime)).toEqual(["Initial", "Late", "Fallback"]);
        expect(updates).toBe(1);
        expect(setup.createdConnections).toEqual([runtime.connection]);
        expect(setup.fallbackFactoryCalls()).toBe(1);
      },
      { endpoint: "https://rpc.test" }
    );

    expect(setup.createdConnections[0]?.rpcEndpoint).toBe("https://rpc.test");
  });

  it("ignores incompatible registry wallets", async () => {
    const compatible = makeStandardWallet("Compatible");
    const incompatible = makeStandardWallet("Incompatible");
    const setup = makeDependencies({
      compatibleStandardWallet: (wallet) => wallet === compatible,
      registry: new FakeWalletRegistry([incompatible, compatible]),
    });

    await withRuntime(setup.dependencies, (runtime) => {
      expect(walletNames(runtime)).toEqual(["Compatible"]);
      expect(setup.standardAdapters.has(incompatible)).toBe(false);
    });
  });

  it("removes and destroys an unregistered wrapper, then restores its fallback", async () => {
    const standardPhantom = makeStandardWallet("Phantom");
    const fallbackPhantom = makeAdapter(
      "Phantom",
      WalletReadyState.NotDetected
    );
    const registry = new FakeWalletRegistry();
    const unregister = registry.register(standardPhantom);
    const setup = makeDependencies({
      fallbacks: [fallbackPhantom],
      registry,
    });

    await withRuntime(setup.dependencies, (runtime) => {
      const standardAdapter = setup.standardAdapters.get(standardPhantom);
      expect(walletNames(runtime)).toEqual(["Phantom"]);
      expect(runtime.getWalletSnapshot().wallets[0]?.adapter).toBe(
        standardAdapter
      );

      unregister();

      expect(walletNames(runtime)).toEqual(["Phantom"]);
      expect(runtime.getWalletSnapshot().wallets[0]?.adapter).toBe(
        fallbackPhantom
      );
      expect(standardAdapter?.destroyCount()).toBe(1);
      expect(standardAdapter?.listenerCount("readyStateChange")).toBe(0);
    });
  });

  it("publishes readiness changes without replacing adapters and filters Unsupported", async () => {
    const first = makeAdapter("First", WalletReadyState.NotDetected);
    const second = makeAdapter("Second", WalletReadyState.Loadable);
    const setup = makeDependencies({ fallbacks: [first, second] });

    await withRuntime(setup.dependencies, (runtime) => {
      const originalFirstDescriptor = runtime.getWalletSnapshot().wallets[0];
      const originalSecondDescriptor = runtime.getWalletSnapshot().wallets[1];
      let updates = 0;
      runtime.subscribe(() => {
        updates += 1;
      });

      first.setReadyState(WalletReadyState.Installed);
      expect(runtime.getWalletSnapshot().wallets[0]).toMatchObject({
        adapter: first,
        readyState: WalletReadyState.Installed,
      });
      expect(runtime.getWalletSnapshot().wallets[0]).not.toBe(
        originalFirstDescriptor
      );
      expect(runtime.getWalletSnapshot().wallets[1]).toBe(
        originalSecondDescriptor
      );

      first.setReadyState(WalletReadyState.Unsupported);
      expect(walletNames(runtime)).toEqual(["Second"]);
      first.setReadyState(WalletReadyState.Loadable);
      expect(walletNames(runtime)).toEqual(["First", "Second"]);
      expect(runtime.getWalletSnapshot().wallets[0]?.adapter).toBe(first);
      expect(updates).toBe(3);
    });
  });

  it("includes one Mobile Wallet Adapter only in an eligible Android browser", async () => {
    const setup = makeDependencies({
      environment: {
        appIdentityUri: "https://widget.test",
        userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile",
      },
      fallbacks: [makeAdapter("Phantom", WalletReadyState.NotDetected)],
    });

    await withRuntime(
      setup.dependencies,
      (runtime) => {
        expect(walletNames(runtime)).toEqual([
          SolanaMobileWalletAdapterWalletName,
          "Phantom",
        ]);
        expect(setup.mobileAdapters).toHaveLength(1);
        expect(setup.mobileInputs).toEqual([
          {
            appIdentityUri: "https://widget.test",
            cluster: "devnet",
          },
        ]);
      },
      { endpoint: "https://api.devnet.solana.com" }
    );

    expect(setup.mobileAdapters[0]?.destroyCount()).toBe(1);
  });

  it.each([
    {
      label: "Android WebView",
      readyState: WalletReadyState.NotDetected,
      userAgent:
        "Mozilla/5.0 (Linux; Android 15; wv) Version/4.0 Chrome/140.0.0.0 Mobile",
    },
    {
      label: "an installed wallet",
      readyState: WalletReadyState.Installed,
      userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile",
    },
    {
      label: "desktop",
      readyState: WalletReadyState.NotDetected,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    },
  ])("does not add Mobile Wallet Adapter for $label", async (testCase) => {
    const setup = makeDependencies({
      environment: {
        appIdentityUri: "https://widget.test",
        userAgent: testCase.userAgent,
      },
      fallbacks: [makeAdapter("Phantom", testCase.readyState)],
    });

    await withRuntime(setup.dependencies, (runtime) => {
      expect(walletNames(runtime)).toEqual(["Phantom"]);
      expect(setup.mobileAdapters).toHaveLength(0);
    });
  });

  it("releases registry and adapter resources and remounts with fresh instances", async () => {
    const registry = new FakeWalletRegistry([makeStandardWallet("Standard")]);
    const scopedFallbacks: FakeAdapter[] = [];
    const baseDependencies = makeDependencies({ registry }).dependencies;
    const dependencies = {
      ...baseDependencies,
      createFallbackAdapters: () => {
        const adapter = makeAdapter("Fallback");
        scopedFallbacks.push(adapter);
        return [adapter];
      },
    };

    await withRuntime(dependencies, (runtime) => {
      expect(registry.listenerCount("register")).toBe(1);
      expect(registry.listenerCount("unregister")).toBe(1);
      expect(walletNames(runtime)).toEqual(["Standard", "Fallback"]);
    });

    expect(registry.listenerCount("register")).toBe(0);
    expect(registry.listenerCount("unregister")).toBe(0);
    expect(scopedFallbacks[0]?.listenerCount("readyStateChange")).toBe(0);
    expect(scopedFallbacks[0]?.destroyCount()).toBe(1);

    await withRuntime(dependencies, (runtime) => {
      expect(walletNames(runtime)).toEqual(["Standard", "Fallback"]);
      expect(scopedFallbacks[1]).not.toBe(scopedFallbacks[0]);
    });
    expect(scopedFallbacks[1]?.destroyCount()).toBe(1);
  });
});
