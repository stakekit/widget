import { describe, expect, it } from "@effect/vitest";
import { convertAddress } from "@luno-kit/core/utils";
import { Effect, Fiber, FiberSet, Queue } from "effect";
import { vi } from "vitest";
import { substrateChainsMap } from "../../../src/services/wallet/internal/adapters/substrate/chains";
import { getSubstrateConnectors } from "../../../src/services/wallet/internal/adapters/substrate/substrate-connector";
import type { ExtraProps } from "../../../src/services/wallet/internal/adapters/substrate/substrate-connector-meta";
import { isWalletCancellation } from "../../../src/services/wallet/wallet-cancellation";
import {
  WalletIntegrationError,
  WalletNotAvailableError,
} from "../../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import {
  type FakeSignClient,
  makeFakeSignClient,
  makeTestWalletConnect,
  walletConnectSession,
} from "../../utils/wallet-connect";

const polkadotChain = "polkadot:91b171bb158e2d3848fa23a9f1c25182";
const bittensorChain = "polkadot:2f0555cc76fc2840a25a6ea3b9637146";
/** Alice in the generic Substrate (42) and Polkadot (0) SS58 formats. */
const alice = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
const alicePolkadot = convertAddress(alice, 0);
const methods = ["polkadot_signTransaction", "polkadot_signMessage"];
const uri = "wc:proposal-1@2?relay-protocol=irn&symKey=00";

const polkadotSession = (
  topic = "polkadot-topic",
  accounts = [`${polkadotChain}:${alicePolkadot}`]
) => walletConnectSession({ topic, namespace: "polkadot", accounts, methods });

const solanaSession = walletConnectSession({
  topic: "solana-topic",
  namespace: "solana",
  accounts: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:solana-account"],
  methods: ["solana_signTransaction"],
});

const signerPayload = {
  address: alice,
  blockHash: "0x01",
  blockNumber: "0x02",
  era: "0x03",
  genesisHash: substrateChainsMap.polkadot.genesisHash,
  metadataRpc: "0x04",
  method: "0x05",
  nonce: "0x06",
  signedExtensions: ["CheckNonce"],
  specVersion: "0x07",
  tip: "0x08",
  transactionVersion: "0x09",
  version: 4,
};

type Connector = ExtraProps & {
  connect: (args?: {
    chainId?: number;
    isReconnecting?: boolean;
  }) => Promise<{ accounts: ReadonlyArray<string>; chainId: number }>;
  disconnect: () => Promise<void>;
  getAccounts: () => Promise<ReadonlyArray<string>>;
  getChainId: () => Promise<number>;
  isAuthorized: () => Promise<boolean>;
};

/**
 * The Substrate WalletConnect wagmi connector over the real protocol and fake
 * SignClient/AppKit. `storage` items survive across connectors to model reloads.
 */
const makeFixture = Effect.fn("makePolkadotWalletConnectFixture")(function* (
  options: {
    readonly signClient?: FakeSignClient;
    readonly storage?: Map<string, unknown>;
  } = {}
) {
  const walletConnect = yield* makeTestWalletConnect(options.signClient);
  const runWalletEffect = yield* FiberSet.makeRuntimePromise();
  const storage = options.storage ?? new Map<string, unknown>();
  const group = yield* getSubstrateConnectors({
    chains: [substrateChainsMap.polkadot, substrateChainsMap.bittensor],
    walletConnectProtocol: walletConnect.protocol,
    runWalletEffect,
  });
  const emitter = { emit: vi.fn() };
  const wallet = group.wallets[0]?.({} as never);
  if (!wallet) return yield* Effect.die("Substrate WalletConnect missing");
  const connector = wallet.createConnector({} as never)({
    emitter,
    storage: {
      getItem: async (key: string) => storage.get(key) ?? null,
      setItem: async (key: string, value: unknown) => {
        storage.set(key, value);
      },
      removeItem: async (key: string) => {
        storage.delete(key);
      },
    },
  } as never) as unknown as Connector;
  return { ...walletConnect, connector, emitter, storage, wallet };
});

const connect = (
  connector: Connector,
  args?: { readonly chainId?: number; readonly isReconnecting?: boolean }
) =>
  Effect.tryPromise({
    try: () => connector.connect(args),
    catch: (cause) =>
      cause instanceof WalletIntegrationError
        ? cause
        : new WalletIntegrationError({
            cause,
            operation: "test-substrate-connect",
            message: "Substrate connection failed",
          }),
  });

const sign = (connector: Connector) =>
  connector.signTransaction({
    tx: signerPayload as never,
    metadataRpc: "0x04",
    rawTx: "{}",
  });

/** Connects through an approved QR proposal. */
const connected = Effect.fn("connectedPolkadotWalletConnect")(function* (
  sessions: ReadonlyArray<unknown> = []
) {
  const fixture = yield* makeFixture({
    signClient: makeFakeSignClient({ sessions }),
  });
  const connecting = yield* connect(fixture.connector).pipe(
    Effect.forkScoped({ startImmediately: true })
  );
  yield* Queue.take(fixture.modal.opened);
  fixture.signClient.approve(polkadotSession());
  yield* Fiber.join(connecting);
  return fixture;
});

describe("Polkadot WalletConnect connector", () => {
  it.live(
    "proposes every configured chain, presents the URI and resolves the approved account",
    () =>
      Effect.gen(function* () {
        const { connector, modal, signClient, storage, wallet } =
          yield* makeFixture();
        const connecting = yield* connect(connector).pipe(
          Effect.forkScoped({ startImmediately: true })
        );

        expect(yield* Queue.take(modal.opened)).toBe(uri);
        const namespace = {
          chains: [polkadotChain, bittensorChain],
          methods,
          events: ["accountsChanged", "chainChanged", "connect"],
        };
        expect(signClient.state.proposals).toEqual([
          {
            requiredNamespaces: { polkadot: namespace },
            optionalNamespaces: { polkadot: namespace },
          },
        ]);
        signClient.approve(polkadotSession());

        expect(yield* Fiber.join(connecting)).toEqual({
          accounts: [alicePolkadot],
          chainId: substrateChainsMap.polkadot.wagmiChain.id,
        });
        expect(yield* Effect.promise(() => connector.getAccounts())).toEqual([
          alicePolkadot,
        ]);
        expect(wallet.id).toBe("walletconnect");
        expect(storage.get("substrate.lastConnectedId")).toBe("walletconnect");
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "resumes the proposal after QR dismissal without disconnecting its accepted session",
    () =>
      Effect.gen(function* () {
        const { connector, modal, signClient } = yield* makeFixture();
        const first = yield* connect(connector).pipe(
          Effect.forkScoped({ startImmediately: true })
        );
        expect(yield* Queue.take(modal.opened)).toBe(uri);
        yield* Effect.promise(() => modal.modal.close());
        const dismissal = yield* Effect.flip(Fiber.join(first));
        expect(dismissal).toMatchObject({ cause: { code: 4001 } });
        expect(isWalletCancellation(dismissal)).toBe(true);

        const retry = yield* connect(connector).pipe(
          Effect.forkScoped({ startImmediately: true })
        );
        expect(yield* Queue.take(modal.opened)).toBe(uri);
        expect(signClient.state.proposals).toHaveLength(1);
        signClient.approve(polkadotSession());

        expect(yield* Fiber.join(retry)).toMatchObject({
          accounts: [alicePolkadot],
        });
        expect(signClient.state.disconnects).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "reports the first configured chain the wallet approved accounts on",
    () =>
      Effect.gen(function* () {
        const { connector, modal, signClient } = yield* makeFixture();
        const connecting = yield* connect(connector).pipe(
          Effect.forkScoped({ startImmediately: true })
        );
        yield* Queue.take(modal.opened);
        signClient.approve(
          polkadotSession("bittensor-topic", [`${bittensorChain}:${alice}`])
        );

        const bittensor = substrateChainsMap.bittensor.wagmiChain.id;
        expect(yield* Fiber.join(connecting)).toEqual({
          accounts: [alice],
          chainId: bittensor,
        });
        expect(yield* Effect.promise(() => connector.getChainId())).toBe(
          bittensor
        );
        expect(yield* Effect.promise(() => connector.getAccounts())).toEqual([
          alice,
        ]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("connects on the requested chain when the wallet approved it", () =>
    Effect.gen(function* () {
      const bittensor = substrateChainsMap.bittensor.wagmiChain.id;
      const { connector, modal, signClient } = yield* makeFixture();
      const connecting = yield* connect(connector, { chainId: bittensor }).pipe(
        Effect.forkScoped({ startImmediately: true })
      );
      yield* Queue.take(modal.opened);
      signClient.approve(
        polkadotSession("both-topic", [
          `${polkadotChain}:${alicePolkadot}`,
          `${bittensorChain}:${alice}`,
        ])
      );

      expect(yield* Fiber.join(connecting)).toEqual({
        accounts: [alice],
        chainId: bittensor,
      });
      expect(yield* Effect.promise(() => connector.getChainId())).toBe(
        bittensor
      );
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "restores an unexpired session after reload without presenting a QR",
    () =>
      Effect.gen(function* () {
        const storage = new Map<string, unknown>();
        storage.set("substrate.lastConnectedId", "walletconnect");
        const { connector, modal, signClient } = yield* makeFixture({
          storage,
          signClient: makeFakeSignClient({
            sessions: [solanaSession, polkadotSession()],
          }),
        });

        expect(yield* Effect.promise(() => connector.isAuthorized())).toBe(
          true
        );
        expect(
          yield* Effect.promise(() =>
            connector.connect({ isReconnecting: true })
          )
        ).toMatchObject({ accounts: [alicePolkadot] });
        expect(signClient.state.proposals).toEqual([]);
        expect(modal.state.visible).toBeUndefined();
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("does not restore without a usable polkadot session", () =>
    Effect.gen(function* () {
      const storage = new Map<string, unknown>();
      storage.set("substrate.lastConnectedId", "walletconnect");
      const { connector, modal, signClient } = yield* makeFixture({
        storage,
        signClient: makeFakeSignClient({
          sessions: [
            solanaSession,
            { ...polkadotSession("expired-topic"), expiry: 1 },
            walletConnectSession({
              topic: "no-signing-topic",
              namespace: "polkadot",
              accounts: [`${polkadotChain}:${alicePolkadot}`],
              methods: ["polkadot_signMessage"],
            }),
            polkadotSession("other-chain-topic", [
              `polkadot:e143f23803ac50e8f6f8e62695d1ce9e:${alice}`,
            ]),
          ],
        }),
      });

      expect(yield* Effect.promise(() => connector.isAuthorized())).toBe(false);
      expect(
        yield* Effect.flip(connect(connector, { isReconnecting: true }))
      ).toMatchObject({ operation: "substrate-reconnect" });
      expect(signClient.state.proposals).toEqual([]);
      expect(modal.state.visible).toBeUndefined();
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "does not restore after an explicit disconnect and keeps other sessions",
    () =>
      Effect.gen(function* () {
        const { connector, signClient, storage } = yield* makeFixture({
          signClient: makeFakeSignClient({
            sessions: [solanaSession, polkadotSession("existing-topic")],
          }),
        });
        // An existing session is reused instead of proposing again.
        expect(yield* Effect.promise(() => connector.connect())).toMatchObject({
          accounts: [alicePolkadot],
        });
        expect(signClient.state.proposals).toEqual([]);

        yield* Effect.promise(() => connector.disconnect());

        expect(signClient.state.disconnects).toEqual(["existing-topic"]);
        expect(signClient.state.sessions).toContainEqual(solanaSession);

        const reloaded = yield* makeFixture({ signClient, storage });
        expect(
          yield* Effect.promise(() => reloaded.connector.isAuthorized())
        ).toBe(false);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("emits a wagmi disconnect when the wallet ends the session", () =>
    Effect.gen(function* () {
      const { connector, emitter, signClient } = yield* connected([
        solanaSession,
      ]);
      emitter.emit.mockClear();

      signClient.end("solana-topic");
      expect(emitter.emit).not.toHaveBeenCalledWith("disconnect");

      signClient.end("polkadot-topic");
      expect(emitter.emit).toHaveBeenCalledWith("disconnect");
      expect(yield* Effect.promise(() => connector.getAccounts())).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "signs through polkadot_signTransaction with the session's address format",
    () =>
      Effect.gen(function* () {
        const { connector, signClient } = yield* connected();
        signClient.state.respond = async () => ({
          id: 1,
          signature: "0xsignature",
          signedTransaction: "0xsigned-extrinsic",
        });

        expect(yield* sign(connector)).toBe("0xsigned-extrinsic");
        expect(signClient.state.requests).toEqual([
          {
            topic: "polkadot-topic",
            chainId: polkadotChain,
            request: {
              method: "polkadot_signTransaction",
              params: {
                address: alicePolkadot,
                transactionPayload: {
                  ...signerPayload,
                  address: alicePolkadot,
                  withSignedTransaction: true,
                },
              },
            },
          },
        ]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "treats a null signedTransaction as absent and encodes the extrinsic locally",
    () =>
      Effect.gen(function* () {
        const { connector, signClient } = yield* connected();
        signClient.state.respond = async () => ({
          id: 1,
          signature: "0xsignature",
          signedTransaction: null,
        });

        // The fixture's metadata is not real, so local encoding itself fails:
        // the response decoded and reached the encoder instead of failing
        // WalletConnect response decoding.
        expect(yield* Effect.flip(sign(connector))).toMatchObject({
          message: "Failed to sign transaction",
          operation: "substrate-sign",
        });
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("rejects malformed responses and foreign signers", () =>
    Effect.gen(function* () {
      const { connector, signClient } = yield* connected();
      signClient.state.respond = async () => ({ signature: 42 });

      expect(yield* Effect.flip(sign(connector))).toMatchObject({
        _tag: "WalletIntegrationError",
      });
      expect(
        yield* Effect.flip(
          connector.signTransaction({
            tx: {
              ...signerPayload,
              genesisHash: substrateChainsMap.bittensor.genesisHash,
            } as never,
            metadataRpc: "0x04",
            rawTx: "{}",
          })
        )
      ).toMatchObject({ operation: "substrate-sign" });
      expect(signClient.state.requests).toHaveLength(1);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("surfaces a wallet rejection as a cancellation", () =>
    Effect.gen(function* () {
      const { connector, signClient } = yield* connected();
      signClient.state.respond = async () => {
        throw { code: 5000, message: "User rejected" };
      };

      expect(isWalletCancellation(yield* Effect.flip(sign(connector)))).toBe(
        true
      );
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );
});

describe("Substrate extension wallets", () => {
  /** The Talisman descriptor and connector, with `window` faked per test. */
  const talisman = Effect.fn("talismanExtension")(function* () {
    const injectedWeb3: Record<string, unknown> = {};
    vi.stubGlobal("window", { injectedWeb3 });
    yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllGlobals()));
    const group = yield* getSubstrateConnectors({
      chains: [substrateChainsMap.polkadot],
      walletConnectProtocol: (yield* makeTestWalletConnect()).protocol,
      runWalletEffect: yield* FiberSet.makeRuntimePromise(),
    });
    const descriptor = group.wallets[1]?.({} as never);
    if (!descriptor) return yield* Effect.die("Talisman missing");
    const connector = descriptor.createConnector({} as never)({
      emitter: { emit: vi.fn() },
      storage: null,
    } as never) as unknown as Connector;
    return { connector, descriptor, injectedWeb3 } as const;
  });

  it.live("detects the extension each time it is asked", () =>
    Effect.gen(function* () {
      const { descriptor, injectedWeb3 } = yield* talisman();
      const { availability } = descriptor;
      if (availability._tag !== "Injected") {
        return yield* Effect.die("Talisman is not an injected wallet");
      }

      expect(descriptor.name).toBe("Talisman");
      expect(availability.installUrl).toMatch(/^https:\/\//);
      expect(yield* availability.detect).toBe(false);
      injectedWeb3.talisman = { enable: async () => ({}) };
      expect(yield* availability.detect).toBe(true);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("reports a missing extension as not available on connect", () =>
    Effect.gen(function* () {
      const { connector } = yield* talisman();

      const failure = yield* Effect.promise(() =>
        connector.connect().then(
          () => undefined,
          (error: unknown) => error
        )
      );
      expect(failure).toEqual(
        new WalletNotAvailableError({ walletId: "talisman" })
      );
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );
});
