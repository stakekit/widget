import { describe, expect, it } from "@effect/vitest";
import type { EventEmitter } from "@tronweb3/tronwallet-abstract-adapter";
import { WalletReadyState } from "@tronweb3/tronwallet-abstract-adapter";
import { Effect } from "effect";
import { afterEach, vi } from "vitest";
import type { Connector } from "wagmi";
import { getTronConnectors } from "../../../src/services/wallet/internal/adapters/tron/tron-connector";
import type { WalletDescriptor } from "../../../src/services/wallet/wallet-descriptors";
import { WalletNotAvailableError } from "../../../src/services/wallet/wallet-errors";
import { runWalletEffect } from "../../utils/run-wallet-effect";
import { unusedWalletConnectProtocol } from "../../utils/wallet-connect";

const tronAddress = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";

/** The part of a tronweb3 adapter the Tron family drives. */
type FakeTronAdapter = EventEmitter & {
  readyState: WalletReadyState;
  address: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: () => Promise<unknown>;
};

const sdk = vi.hoisted(() => {
  const adapters = new Map<string, FakeTronAdapter>();
  const injected = new Set<string>();
  const fakeAdapterModule = (name: string, exportName: string) => async () => {
    // vi.mock factories run before the file's static imports are bound.
    const { EventEmitter, WalletNotFoundError, WalletReadyState } =
      await import("@tronweb3/tronwallet-abstract-adapter");
    class Adapter extends EventEmitter {
      // Like the SDK, an adapter finds a provider that is already injected.
      readyState = injected.has(name)
        ? WalletReadyState.Found
        : WalletReadyState.Loading;
      address: string | null = null;
      connected = false;
      constructor() {
        super();
        adapters.set(name, this as unknown as FakeTronAdapter);
      }
      async connect() {
        if (this.readyState !== WalletReadyState.Found) {
          throw new WalletNotFoundError();
        }
        this.address = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
      }
      async disconnect() {}
      async signTransaction() {
        return {};
      }
    }
    return { [exportName]: Adapter };
  };
  return { adapters, fakeAdapterModule, injected };
});

vi.mock(
  "@tronweb3/tronwallet-adapter-tronlink",
  sdk.fakeAdapterModule("tronLink", "TronLinkAdapter")
);
vi.mock(
  "@tronweb3/tronwallet-adapter-bitkeep",
  sdk.fakeAdapterModule("tronBg", "BitKeepAdapter")
);
vi.mock(
  "@tronweb3/tronwallet-adapter-ledger",
  sdk.fakeAdapterModule("tronLedger", "LedgerAdapter")
);

const descriptors = () => {
  sdk.adapters.clear();
  const wallets = getTronConnectors({
    walletConnectProtocol: unusedWalletConnectProtocol,
    runWalletEffect,
  }).wallets.map((createWallet) => createWallet({} as never));
  const byId = (id: string): WalletDescriptor => {
    const wallet = wallets.find((candidate) => candidate.id === id);
    if (!wallet) throw new Error(`Tron wallet ${id} missing`);
    return wallet;
  };
  const adapter = (id: string) => {
    const found = sdk.adapters.get(id);
    if (!found) throw new Error(`Tron adapter ${id} missing`);
    return found;
  };
  return { adapter, byId };
};

const settle = (adapter: FakeTronAdapter, readyState: WalletReadyState) => {
  adapter.readyState = readyState;
  adapter.emit("readyStateChanged", readyState);
};

/** What each extension injects into the page, as the tronweb3 adapters look for it. */
const injectedGlobals = {
  tronLink: { tron: { isTronLink: true } },
  tronBg: { isBitKeep: true, tronLink: {} },
} as const;

const inject = (id: keyof typeof injectedGlobals) => {
  sdk.injected.add(id);
  Object.assign(globalThis, injectedGlobals[id]);
};

afterEach(() => {
  sdk.injected.clear();
  for (const key of ["tron", "tronLink", "isBitKeep"]) {
    Reflect.deleteProperty(globalThis, key);
  }
});

const detect = (wallet: WalletDescriptor) =>
  wallet.availability._tag === "Injected"
    ? wallet.availability.detect
    : Effect.die(`${wallet.id} is not an injected wallet`);

describe("Tron wallet availability", () => {
  it("offers TronLink and Bitget as extensions with their store pages", () => {
    const { byId } = descriptors();

    expect(byId("tronLink").availability).toMatchObject({
      _tag: "Injected",
      installUrl:
        "https://chromewebstore.google.com/detail/tronlink/ibnejdfjmmkpcnlpebklmnkoeoihofec",
    });
    expect(byId("tronBg").availability).toMatchObject({
      _tag: "Injected",
      installUrl:
        "https://chromewebstore.google.com/detail/bitget-wallet-crypto-web3/jiidiaalihmmhddjgbnbgdfflelocpak",
    });
    expect(byId("tronWc").availability).toEqual({ _tag: "Remote" });
    expect(byId("tronLedger").availability).toEqual({ _tag: "Remote" });
  });

  it.effect("detects the extension from the adapter's live readyState", () =>
    Effect.gen(function* () {
      const { adapter, byId } = descriptors();
      settle(adapter("tronLink"), WalletReadyState.NotFound);
      settle(adapter("tronBg"), WalletReadyState.Found);

      expect(yield* detect(byId("tronLink"))).toBe(false);
      expect(yield* detect(byId("tronBg"))).toBe(true);

      settle(adapter("tronLink"), WalletReadyState.Found);

      expect(yield* detect(byId("tronLink"))).toBe(true);
    })
  );

  it.effect(
    "answers from the injected provider while discovery is still running",
    () =>
      Effect.gen(function* () {
        const { byId } = descriptors();
        inject("tronLink");

        expect(yield* detect(byId("tronLink"))).toBe(true);
      })
  );

  it.effect.each(["tronLink", "tronBg"] as const)(
    "connects %s when its extension appears after discovery gave up",
    (id) =>
      Effect.gen(function* () {
        const { adapter, byId } = descriptors();
        settle(adapter(id), WalletReadyState.NotFound);
        const connector = byId(id).createConnector({} as never)({
          emitter: { emit: vi.fn() },
          storage: null,
        } as never) as unknown as Connector & {
          connect: () => Promise<{ accounts: ReadonlyArray<string> }>;
        };

        inject(id);

        expect(yield* detect(byId(id))).toBe(true);
        const { accounts } = yield* Effect.promise(() => connector.connect());
        expect(accounts).toEqual([tronAddress]);
      })
  );

  it.effect(
    "reports the wallet as unavailable when the extension is gone at connect",
    () =>
      Effect.gen(function* () {
        const { adapter, byId } = descriptors();
        settle(adapter("tronLink"), WalletReadyState.NotFound);
        const connector = byId("tronLink").createConnector({} as never)({
          emitter: { emit: vi.fn() },
          storage: null,
        } as never) as unknown as Connector & {
          connect: () => Promise<unknown>;
        };

        const error = yield* Effect.promise(() =>
          connector.connect().then(
            () => undefined,
            (cause: unknown) => cause
          )
        );

        expect(error).toBeInstanceOf(WalletNotAvailableError);
        expect(error).toMatchObject({ walletId: "tronLink" });
      })
  );
});
