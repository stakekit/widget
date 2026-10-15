import { fromHex, toBase64, toHex } from "@cosmjs/encoding";
import type { MainWalletBase } from "@cosmos-kit/core";
import { describe, expect, it } from "@effect/vitest";
import { SignDoc, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { Effect, Fiber, Option, Queue, Schema, Stream } from "effect";
import { type Mock, vi } from "vitest";
import type { CosmosChainsMap } from "../../../src/services/wallet/internal/adapters/cosmos/chains";
import { createCosmosConnector } from "../../../src/services/wallet/internal/adapters/cosmos/cosmos-connector";
import type { CosmosConnector } from "../../../src/services/wallet/internal/adapters/cosmos/cosmos-connector-meta";
import { makeExtensionWallet } from "../../../src/services/wallet/internal/adapters/cosmos/extension-wallet";
import { makeCosmosWalletConnectWallet } from "../../../src/services/wallet/internal/adapters/cosmos/wallet-connect";
import type { WalletConnectProtocol } from "../../../src/services/wallet/internal/platform/wallet-connect-protocol";
import { isWalletCancellation } from "../../../src/services/wallet/wallet-cancellation";
import { WalletNotAvailableError } from "../../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import { runWalletEffect } from "../../utils/run-wallet-effect";
import {
  type FakeSignClient,
  makeFakeSignClient,
  makeTestWalletConnect,
  walletConnectSession,
} from "../../utils/wallet-connect";

const chainId = "cosmoshub-4";
const address = "cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu";
const otherAddress = "cosmos1zg69v7ys40x77y352eufp27daufrg4ncnjqz7q";
const account = `cosmos:${chainId}:${address}`;
const methods = ["cosmos_getAccounts", "cosmos_signDirect", "cosmos_signAmino"];
const uri = "wc:proposal-1@2?relay-protocol=irn&symKey=00";
const pubkey = new Uint8Array(33).fill(2);
const signature = new Uint8Array(64).fill(7);
const wagmiChain = {
  id: chainId as unknown as number,
  name: "Cosmos Hub",
  nativeCurrency: { name: "Atom", symbol: "ATOM", decimals: 6 },
  rpcUrls: { default: { http: [""] } },
};
const osmosisChainId = "osmosis-1";
const osmosisAddress = "osmo1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5afv7ye";
const osmosisWagmiChain = {
  ...wagmiChain,
  id: osmosisChainId as unknown as number,
  name: "Osmosis",
};
const cosmosChainsMap = {
  cosmos: {
    type: "cosmos",
    network: "cosmos",
    wagmiChain,
    chain: { chain_id: chainId, chain_name: "cosmoshub" },
  },
  osmosis: {
    type: "cosmos",
    network: "osmosis",
    wagmiChain: osmosisWagmiChain,
    chain: { chain_id: osmosisChainId, chain_name: "osmosis" },
  },
} as unknown as Partial<CosmosChainsMap>;

const cosmosSession = (
  input: { topic?: string; expiry?: number; accounts?: string[] } = {}
) =>
  walletConnectSession({
    topic: input.topic ?? "cosmos-session",
    namespace: "cosmos",
    accounts: input.accounts ?? [account],
    methods,
    ...(input.expiry !== undefined && { expiry: input.expiry }),
  });

const WireSignDocRequest = Schema.Struct({
  signerAddress: Schema.String,
  signDoc: Schema.Struct({
    chainId: Schema.String,
    bodyBytes: Schema.String,
    authInfoBytes: Schema.String,
    accountNumber: Schema.String,
  }),
});

/** Answers `cosmos_getAccounts` with another account listed first. */
const respondAccounts: FakeSignClient["state"]["respond"] = async ({
  request,
}) => {
  if (request.method !== "cosmos_getAccounts") {
    throw new Error(`Unexpected request ${request.method}`);
  }
  return [
    {
      address: otherAddress,
      algo: "secp256k1",
      pubkey: toBase64(new Uint8Array(33).fill(3)),
    },
    { address, algo: "secp256k1", pubkey: toBase64(pubkey) },
  ];
};

const makeStorage = () => {
  const items = new Map<string, unknown>();
  let gate: Promise<void> | undefined;
  return {
    items,
    /** Holds writes until the returned release is called. */
    pauseWrites: () => {
      const paused = Promise.withResolvers<void>();
      gate = paused.promise;
      return () => {
        gate = undefined;
        paused.resolve();
      };
    },
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: unknown) => {
      await gate;
      items.set(key, value);
    },
    removeItem: async (key: string) => {
      items.delete(key);
    },
  };
};

const makeConnector = ({
  protocol,
  storage,
}: {
  readonly protocol: WalletConnectProtocol;
  readonly storage: ReturnType<typeof makeStorage>;
}) => {
  const persisted: Array<{ address: string; publicKey: string }> = [];
  const descriptor = createCosmosConnector({
    wallet: makeCosmosWalletConnectWallet({
      iconUrl: "",
      runWalletEffect,
      walletConnectProtocol: protocol,
    }),
    cosmosChainsMap,
    cosmosWagmiChains: [wagmiChain, osmosisWagmiChain],
    persistPublicKey: async (input) => {
      persisted.push(input);
    },
    runWalletEffect,
  });
  const emitter = { emit: vi.fn() };
  const connector = descriptor.createConnector({} as never)({
    chains: [wagmiChain, osmosisWagmiChain],
    emitter,
    storage,
  } as never) as unknown as CosmosConnector;
  return { connector, emitter, persisted };
};

const makeFixture = Effect.fn("makeCosmosWalletConnectFixture")(function* (
  options: {
    readonly sessions?: ReadonlyArray<unknown>;
    readonly request?: FakeSignClient["state"]["respond"];
    readonly storage?: ReturnType<typeof makeStorage>;
  } = {}
) {
  const storage = options.storage ?? makeStorage();
  const { modal, protocol, signClient } = yield* makeTestWalletConnect(
    makeFakeSignClient({
      sessions: options.sessions,
      request: options.request ?? respondAccounts,
    })
  );
  return {
    ...makeConnector({ protocol, storage }),
    opened: modal.opened,
    signClient,
    storage,
  };
});

type Fixture = Effect.Success<ReturnType<typeof makeFixture>>;

const connectApproved = (fixture: Fixture) =>
  Effect.gen(function* () {
    const connecting = yield* Effect.promise(() =>
      fixture.connector.connect()
    ).pipe(Effect.forkScoped);
    expect(yield* Queue.take(fixture.opened)).toBe(uri);
    fixture.signClient.approve(cosmosSession());
    return yield* Fiber.join(connecting);
  });

describe("Cosmos WalletConnect connector", () => {
  it.live(
    "presents the pairing URI and resolves the approved account for the selected chain",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture();

        expect(yield* connectApproved(fixture)).toEqual({
          accounts: [address],
          chainId,
        });
        expect(fixture.signClient.state.proposals).toEqual([
          {
            requiredNamespaces: {
              cosmos: {
                chains: [`cosmos:${chainId}`],
                methods,
                events: ["chainChanged", "accountsChanged"],
              },
            },
            optionalNamespaces: {
              cosmos: {
                chains: [`cosmos:${chainId}`],
                methods: [],
                events: ["chainChanged", "accountsChanged"],
              },
            },
          },
        ]);
        expect(
          yield* Effect.promise(() => fixture.connector.getAccounts())
        ).toEqual([address]);
        // The session account's metadata, not the wallet's first account.
        expect(fixture.persisted).toEqual([
          { address, publicKey: toBase64(pubkey) },
        ]);
        expect(fixture.signClient.state.requests).toEqual([
          {
            topic: "cosmos-session",
            chainId: `cosmos:${chainId}`,
            request: { method: "cosmos_getAccounts", params: {} },
          },
        ]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "resumes the same proposal after QR dismissal without disconnecting its session",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture();
        const walletModal = yield* WalletModal;

        const first = yield* Effect.promise(() =>
          fixture.connector.connect().then(
            () => undefined,
            (error: unknown) => error
          )
        ).pipe(Effect.forkScoped);
        expect(yield* Queue.take(fixture.opened)).toBe(uri);
        yield* walletModal.connectOpen.set(false);
        expect(isWalletCancellation(yield* Fiber.join(first))).toBe(true);

        expect(yield* connectApproved(fixture)).toEqual({
          accounts: [address],
          chainId,
        });
        expect(fixture.signClient.state.proposals).toHaveLength(1);
        expect(fixture.signClient.state.disconnects).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "restores a live session holding the saved account after reload without a QR",
    () =>
      Effect.gen(function* () {
        const before = yield* makeFixture();
        yield* connectApproved(before);

        const after = yield* makeFixture({
          sessions: before.signClient.state.sessions,
          storage: before.storage,
        });

        expect(
          yield* Effect.promise(() => after.connector.isAuthorized())
        ).toBe(true);
        expect(
          yield* Effect.promise(() =>
            after.connector.connect({ isReconnecting: true })
          )
        ).toEqual({ accounts: [address], chainId });
        expect(after.signClient.state.proposals).toEqual([]);
        expect(yield* Queue.size(after.opened)).toBe(0);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "does not restore a saved account whose session ended, expired or lacks it",
    () =>
      Effect.gen(function* () {
        const before = yield* makeFixture();
        yield* connectApproved(before);

        for (const sessions of [
          [],
          [cosmosSession({ expiry: 1 })],
          [cosmosSession({ accounts: [`cosmos:${chainId}:${otherAddress}`] })],
        ]) {
          const after = yield* makeFixture({
            sessions,
            storage: before.storage,
          });
          expect(
            yield* Effect.promise(() => after.connector.isAuthorized())
          ).toBe(false);
        }
        const after = yield* makeFixture({ storage: before.storage });
        const failure = yield* Effect.tryPromise(() =>
          after.connector.connect({ isReconnecting: true })
        ).pipe(Effect.flip);
        expect(failure).toBeDefined();
        expect(after.signClient.state.proposals).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("does not restore after the user disconnected", () =>
    Effect.gen(function* () {
      const before = yield* makeFixture();
      yield* connectApproved(before);
      yield* Effect.promise(() => before.connector.disconnect());

      const after = yield* makeFixture({
        sessions: [cosmosSession()],
        storage: before.storage,
      });
      expect(yield* Effect.promise(() => after.connector.isAuthorized())).toBe(
        false
      );
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("emits a wagmi disconnect when the wallet ends the session", () =>
    Effect.gen(function* () {
      const fixture = yield* makeFixture();
      yield* connectApproved(fixture);

      fixture.signClient.end("cosmos-session");

      expect(fixture.emitter.emit).toHaveBeenCalledWith("disconnect");
      expect(
        yield* Effect.promise(() => fixture.connector.getAccounts())
      ).toEqual([]);
      expect(fixture.signClient.state.disconnects).toEqual([]);
      expect(
        yield* Effect.promise(() => fixture.connector.isAuthorized())
      ).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "signs with cosmos_signDirect and encodes the document the wallet signed",
    () =>
      Effect.gen(function* () {
        const signDoc = SignDoc.fromPartial({
          bodyBytes: new Uint8Array([1, 2, 3]),
          authInfoBytes: new Uint8Array([4, 5]),
          chainId,
          accountNumber: 42n,
        });
        const walletBody = new Uint8Array([9, 9, 9]);
        const fixture = yield* makeFixture({
          request: async (input) => {
            if (input.request.method !== "cosmos_signDirect") {
              return respondAccounts(input);
            }
            const params = Schema.decodeUnknownSync(WireSignDocRequest)(
              input.request.params
            );
            return {
              signed: { ...params.signDoc, bodyBytes: toBase64(walletBody) },
              signature: {
                pub_key: {
                  type: "tendermint/PubKeySecp256k1",
                  value: toBase64(pubkey),
                },
                signature: toBase64(signature),
              },
            };
          },
        });
        yield* connectApproved(fixture);
        const chainWallet = yield* fixture.connector.$chainWallet.pipe(
          Stream.runHead,
          Effect.map(Option.getOrNull)
        );
        if (!chainWallet) return yield* Effect.die("Chain wallet missing");

        const signed = yield* fixture.connector.signTransaction({
          cw: chainWallet,
          tx: toHex(SignDoc.encode(signDoc).finish()),
        });

        expect(fixture.signClient.state.requests.at(-1)).toEqual({
          topic: "cosmos-session",
          chainId: `cosmos:${chainId}`,
          request: {
            method: "cosmos_signDirect",
            params: {
              signerAddress: address,
              signDoc: {
                chainId,
                bodyBytes: toBase64(signDoc.bodyBytes),
                authInfoBytes: toBase64(signDoc.authInfoBytes),
                accountNumber: "42",
              },
            },
          },
        });
        const tx = TxRaw.decode(fromHex(signed));
        expect(tx.bodyBytes).toEqual(walletBody);
        expect(tx.authInfoBytes).toEqual(signDoc.authInfoBytes);
        expect(tx.signatures).toEqual([signature]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("surfaces a wallet signing rejection as a cancellation", () =>
    Effect.gen(function* () {
      const fixture = yield* makeFixture({
        request: async (input) => {
          if (input.request.method !== "cosmos_signDirect") {
            return respondAccounts(input);
          }
          throw { code: 4001, message: "User rejected the request" };
        },
      });
      yield* connectApproved(fixture);
      const chainWallet = yield* fixture.connector.$chainWallet.pipe(
        Stream.runHead,
        Effect.map(Option.getOrNull)
      );
      if (!chainWallet) return yield* Effect.die("Chain wallet missing");

      const error = yield* fixture.connector
        .signTransaction({
          cw: chainWallet,
          tx: toHex(SignDoc.encode(SignDoc.fromPartial({ chainId })).finish()),
        })
        .pipe(Effect.flip);

      expect(isWalletCancellation(error)).toBe(true);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("disconnects only its own session topic", () =>
    Effect.gen(function* () {
      const solana = walletConnectSession({
        topic: "solana-session",
        namespace: "solana",
        accounts: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:payer"],
      });
      const fixture = yield* makeFixture({ sessions: [solana] });
      yield* connectApproved(fixture);

      yield* Effect.promise(() => fixture.connector.disconnect());

      expect(fixture.signClient.state.disconnects).toEqual(["cosmos-session"]);
      expect(fixture.signClient.state.sessions).toEqual([solana]);
      expect(
        yield* Effect.promise(() => fixture.connector.getAccounts())
      ).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "stays disconnected when the wallet ends the session while it is being saved",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture();
        const releaseWrites = fixture.storage.pauseWrites();
        const connecting = yield* Effect.tryPromise(() =>
          fixture.connector.connect()
        ).pipe(Effect.exit, Effect.forkScoped);
        expect(yield* Queue.take(fixture.opened)).toBe(uri);
        fixture.signClient.approve(cosmosSession());
        // Let the approval reach the pending storage write.
        yield* Effect.sleep("20 millis");

        fixture.signClient.end("cosmos-session");
        releaseWrites();

        expect((yield* Fiber.join(connecting))._tag).toBe("Failure");
        expect(
          yield* Effect.promise(() => fixture.connector.getAccounts())
        ).toEqual([]);
        expect(
          yield* fixture.connector.$chainWallet.pipe(
            Stream.runHead,
            Effect.map(Option.getOrNull)
          )
        ).toBeNull();
        expect(fixture.storage.items.size).toBe(0);
        expect(
          yield* Effect.promise(() => fixture.connector.isAuthorized())
        ).toBe(false);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("connects on the host's initial chain when it is requested", () =>
    Effect.gen(function* () {
      const fixture = yield* makeFixture();
      const connecting = yield* Effect.promise(() =>
        fixture.connector.connect({
          chainId: osmosisChainId as unknown as number,
        })
      ).pipe(Effect.forkScoped);
      expect(yield* Queue.take(fixture.opened)).toBe(uri);
      fixture.signClient.approve(
        cosmosSession({
          accounts: [`cosmos:${osmosisChainId}:${osmosisAddress}`],
        })
      );
      fixture.signClient.state.respond = async () => [
        {
          address: osmosisAddress,
          algo: "secp256k1",
          pubkey: toBase64(pubkey),
        },
      ];

      expect(yield* Fiber.join(connecting)).toEqual({
        accounts: [osmosisAddress],
        chainId: osmosisChainId,
      });
      expect(
        fixture.signClient.state.proposals[0]?.requiredNamespaces?.cosmos
          ?.chains
      ).toEqual([`cosmos:${osmosisChainId}`]);
      expect(yield* Effect.promise(() => fixture.connector.getChainId())).toBe(
        osmosisChainId
      );
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "switches back to a chain approved before reload without proposing again",
    () =>
      Effect.gen(function* () {
        // Each chain's account, as the wallet reports it for that chain.
        const request: FakeSignClient["state"]["respond"] = async (input) =>
          input.chainId === `cosmos:${osmosisChainId}`
            ? [{ address: osmosisAddress, pubkey: toBase64(pubkey) }]
            : respondAccounts(input);
        const before = yield* makeFixture({ request });
        yield* connectApproved(before);
        const switching = yield* Effect.promise(async () =>
          before.connector.switchChain?.({
            chainId: osmosisChainId as unknown as number,
          })
        ).pipe(Effect.forkScoped);
        yield* Queue.take(before.opened);
        before.signClient.approve(
          cosmosSession({
            topic: "osmosis-session",
            accounts: [`cosmos:${osmosisChainId}:${osmosisAddress}`],
          })
        );
        yield* Fiber.join(switching);

        const after = yield* makeFixture({
          request,
          sessions: before.signClient.state.sessions,
          storage: before.storage,
        });
        expect(
          yield* Effect.promise(() =>
            after.connector.connect({ isReconnecting: true })
          )
        ).toEqual({ accounts: [osmosisAddress], chainId: osmosisChainId });
        yield* Effect.promise(async () =>
          after.connector.switchChain?.({
            chainId: chainId as unknown as number,
          })
        );

        expect(after.signClient.state.proposals).toEqual([]);
        expect(yield* Queue.size(after.opened)).toBe(0);
        expect(
          yield* Effect.promise(() => after.connector.getAccounts())
        ).toEqual([address]);
        expect(yield* Effect.promise(() => after.connector.getChainId())).toBe(
          chainId
        );
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );
});

describe("Cosmos extension wallets", () => {
  /**
   * Keplr over a fake page: cosmos-kit's client reads `window.keplr` when
   * `initClient` runs and keeps that client afterwards, as the real one does.
   */
  const makeExtension = Effect.fn("makeKeplrExtension")(function* () {
    const page: { keplr?: object } = {};
    vi.stubGlobal("window", page);
    yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllGlobals()));
    const clientMutable: { state: string; data: object | undefined } = {
      state: "Done",
      data: undefined,
    };
    const wallet = {
      walletInfo: {
        name: "keplr-extension",
        prettyName: "Keplr",
        logo: "",
        downloads: [
          {
            device: "desktop",
            browser: "chrome",
            link: "https://chrome/keplr",
          },
          { link: "https://keplr.app/download" },
        ],
      },
      clientMutable,
      get client() {
        return clientMutable.data;
      },
      initClient: async () => {
        clientMutable.data = page.keplr && {};
      },
      getChainWallet: () => ({ chainId, address: undefined, connect: vi.fn() }),
    } as unknown as MainWalletBase;
    const descriptor = createCosmosConnector({
      wallet: makeExtensionWallet(wallet, "keplr"),
      cosmosChainsMap,
      cosmosWagmiChains: [wagmiChain],
      persistPublicKey: async () => undefined,
      runWalletEffect,
    });
    const { availability } = descriptor;
    if (availability._tag !== "Injected") {
      return yield* Effect.die("Keplr is not an injected wallet");
    }
    const connector = descriptor.createConnector({} as never)({
      chains: [wagmiChain],
      emitter: { emit: vi.fn() },
      storage: makeStorage(),
    } as never) as unknown as CosmosConnector;
    const connectFailure = Effect.promise(() =>
      connector.connect().then(
        () => undefined,
        (error: unknown) => error
      )
    );
    return { availability, connectFailure, page } as const;
  });

  it.effect(
    "detects an extension installed after the wallet manager read",
    () =>
      Effect.gen(function* () {
        const { availability, page } = yield* makeExtension();

        expect(availability.installUrl).toBe("https://chrome/keplr");
        expect(yield* availability.detect).toBe(false);
        page.keplr = {};
        expect(yield* availability.detect).toBe(true);
      }).pipe(Effect.scoped)
  );

  it.effect("stops detecting an extension removed after it was read", () =>
    Effect.gen(function* () {
      const { availability, connectFailure, page } = yield* makeExtension();
      page.keplr = {};
      expect(yield* availability.detect).toBe(true);

      delete page.keplr;

      expect(yield* availability.detect).toBe(false);
      expect(yield* connectFailure).toEqual(
        new WalletNotAvailableError({ walletId: "keplr-extension" })
      );
    }).pipe(Effect.scoped)
  );

  it.effect("reports a missing extension as not available on connect", () =>
    Effect.gen(function* () {
      const { connectFailure } = yield* makeExtension();

      expect(yield* connectFailure).toEqual(
        new WalletNotAvailableError({ walletId: "keplr-extension" })
      );
    }).pipe(Effect.scoped)
  );
});

describe("Cosmos extension wallet reconnect", () => {
  const addresses: Record<string, string> = {
    [chainId]: address,
    [osmosisChainId]: osmosisAddress,
  };

  /**
   * Keplr over cosmos-kit after a page load: cosmos-kit has restored the
   * accounts of `restored` chains only, as its manager does on mount.
   */
  const makeKeplr = (restored: ReadonlyArray<string> = []) => {
    vi.stubGlobal("window", { keplr: {} });
    const chainWallets = [
      { chainId, chainName: "cosmoshub" },
      { chainId: osmosisChainId, chainName: "osmosis" },
    ].map(({ chainId, chainName }) => {
      const cw: {
        chainId: string;
        chainName: string;
        address: string | undefined;
        client: object;
        connect: Mock<() => Promise<void>>;
        disconnect: Mock<() => Promise<void>>;
      } = {
        chainId,
        chainName,
        address: restored.includes(chainId) ? addresses[chainId] : undefined,
        client: {
          getAccount: async () => ({ address: cw.address, pubkey }),
        },
        connect: vi.fn(async () => {
          cw.address = addresses[chainId];
        }),
        disconnect: vi.fn(async () => {
          cw.address = undefined;
        }),
      };
      return cw;
    });
    const wallet = {
      walletInfo: { name: "keplr-extension", prettyName: "Keplr", logo: "" },
      clientMutable: { state: "Done", data: {} },
      client: {},
      initClient: async () => undefined,
      getChainWallet: (name: string) =>
        chainWallets.find((cw) => cw.chainName === name),
      getChainWalletList: () => chainWallets,
    } as unknown as MainWalletBase;
    return { chainWallets, wallet };
  };

  const makeExtensionConnector = (wallet: MainWalletBase, storage: object) =>
    createCosmosConnector({
      wallet: makeExtensionWallet(wallet, "keplr"),
      cosmosChainsMap,
      cosmosWagmiChains: [wagmiChain, osmosisWagmiChain],
      persistPublicKey: async () => undefined,
      runWalletEffect,
    }).createConnector({} as never)({
      chains: [wagmiChain, osmosisWagmiChain],
      emitter: { emit: vi.fn() },
      storage,
    } as never) as unknown as CosmosConnector;

  const unstubWindow = Effect.addFinalizer(() =>
    Effect.sync(() => vi.unstubAllGlobals())
  );

  it.effect("restores the chain it connected on after reload", () =>
    Effect.gen(function* () {
      yield* unstubWindow;
      const storage = makeStorage();
      const before = makeKeplr();
      yield* Effect.promise(() =>
        makeExtensionConnector(before.wallet, storage).connect({
          chainId: osmosisChainId as unknown as number,
        })
      );
      expect(before.chainWallets[1]?.connect).toHaveBeenCalledOnce();

      const after = makeKeplr([osmosisChainId]);
      const reloaded = makeExtensionConnector(after.wallet, storage);

      expect(yield* Effect.promise(() => reloaded.isAuthorized())).toBe(true);
      expect(
        yield* Effect.promise(() => reloaded.connect({ isReconnecting: true }))
      ).toEqual({ accounts: [osmosisAddress], chainId: osmosisChainId });
      expect(yield* Effect.promise(() => reloaded.getChainId())).toBe(
        osmosisChainId
      );
      for (const cw of after.chainWallets) {
        expect(cw.connect).not.toHaveBeenCalled();
      }
    }).pipe(Effect.scoped)
  );

  it.effect(
    "prefers the saved chain over other chains cosmos-kit restored",
    () =>
      Effect.gen(function* () {
        yield* unstubWindow;
        const storage = makeStorage();
        const before = makeKeplr();
        yield* Effect.promise(() =>
          makeExtensionConnector(before.wallet, storage).connect({
            chainId: osmosisChainId as unknown as number,
          })
        );

        const after = makeKeplr([chainId, osmosisChainId]);
        const reloaded = makeExtensionConnector(after.wallet, storage);

        expect(
          yield* Effect.promise(() =>
            reloaded.connect({ isReconnecting: true })
          )
        ).toEqual({ accounts: [osmosisAddress], chainId: osmosisChainId });
      }).pipe(Effect.scoped)
  );

  it.effect(
    "falls back to a restored chain and never prompts without one",
    () =>
      Effect.gen(function* () {
        yield* unstubWindow;
        const restored = makeKeplr([osmosisChainId]);
        const connector = makeExtensionConnector(
          restored.wallet,
          makeStorage()
        );
        expect(yield* Effect.promise(() => connector.isAuthorized())).toBe(
          true
        );
        expect(
          yield* Effect.promise(() =>
            connector.connect({ isReconnecting: true })
          )
        ).toEqual({ accounts: [osmosisAddress], chainId: osmosisChainId });

        const none = makeKeplr();
        const fresh = makeExtensionConnector(none.wallet, makeStorage());
        expect(yield* Effect.promise(() => fresh.isAuthorized())).toBe(false);
        const failure = yield* Effect.tryPromise(() =>
          fresh.connect({ isReconnecting: true })
        ).pipe(Effect.flip);
        expect(failure).toBeDefined();
        for (const cw of none.chainWallets) {
          expect(cw.connect).not.toHaveBeenCalled();
        }
      }).pipe(Effect.scoped)
  );
});
