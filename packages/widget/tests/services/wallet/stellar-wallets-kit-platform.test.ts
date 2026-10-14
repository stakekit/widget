import { describe, expect, it, vi } from "@effect/vitest";
import { Clock, Effect, Exit, Fiber, FiberSet, Queue, Scope } from "effect";
import type { Connector } from "wagmi";
import { getStellarConnectors } from "../../../src/services/wallet/internal/adapters/stellar/stellar-connector";
import {
  makeDirectStellarWalletClient,
  makeWalletConnectStellarWalletClient,
  type StellarWalletModule,
} from "../../../src/services/wallet/internal/platform/stellar-wallets-kit-platform";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import {
  makeFakeSignClient,
  makeTestWalletConnect,
  walletConnectSession,
} from "../../utils/wallet-connect";

const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const publicNetworkPassphrase =
  "Public Global Stellar Network ; September 2015";

const makeModule = (
  overrides: Partial<StellarWalletModule> = {}
): StellarWalletModule => ({
  disconnect: undefined,
  getAddress: vi.fn(async () => ({ address })),
  getNetwork: vi.fn(async () => ({
    network: "PUBLIC",
    networkPassphrase: publicNetworkPassphrase,
  })),
  isAvailable: vi.fn(async () => true),
  productIcon: "https://example.com/wallet.png",
  productId: "freighter",
  productName: "Freighter",
  signTransaction: vi.fn(async () => ({ signedTxXdr: "signed-xdr" })),
  ...overrides,
});

const makeSession = (
  topic: string,
  accounts = [`stellar:pubnet:${address}`],
  methods = ["stellar_signXDR"]
) => walletConnectSession({ topic, namespace: "stellar", accounts, methods });

/** The Stellar WalletConnect client over the shared protocol and fake SDKs. */
const makeWalletConnectClient = (sessions: ReadonlyArray<unknown> = []) =>
  Effect.gen(function* () {
    const walletConnect = yield* makeTestWalletConnect(
      makeFakeSignClient({
        sessions,
        request: async () => ({ signedXDR: "signed-xdr" }),
      })
    );
    const client = yield* makeWalletConnectStellarWalletClient(
      walletConnect.protocol
    );
    return { ...walletConnect, client };
  });

const signInput = {
  address,
  networkPassphrase: publicNetworkPassphrase,
  transactionXdr: "unsigned-xdr",
};

describe("Stellar Wallets Kit platform", () => {
  it.effect(
    "restores Freighter by reading its live account without prompting",
    () =>
      Effect.gen(function* () {
        const module = makeModule();
        const client = makeDirectStellarWalletClient({
          id: "freighter",
          module,
          validateMainnet: true,
        });

        expect(yield* client.reconnect(address)).toEqual({ address });
        expect(module.getAddress).toHaveBeenCalledWith({
          skipRequestAccess: true,
        });
      })
  );

  it.effect("rejects Freighter when it reports a non-mainnet network", () =>
    Effect.gen(function* () {
      const module = makeModule({
        getNetwork: vi.fn(async () => ({
          network: "TESTNET",
          networkPassphrase: "Test SDF Network ; September 2015",
        })),
      });
      const client = makeDirectStellarWalletClient({
        id: "freighter",
        module,
        validateMainnet: true,
      });

      expect(yield* Effect.flip(client.connect)).toMatchObject({
        _tag: "WalletIntegrationError",
        operation: "stellar-read-network",
      });
    })
  );

  it.effect("signs and disconnects only the restored mainnet session", () =>
    Effect.gen(function* () {
      const { client, signClient } = yield* makeWalletConnectClient([
        null,
        walletConnectSession({
          topic: "evm-topic",
          namespace: "eip155",
          accounts: ["eip155:1:0xabc"],
        }),
        makeSession("testnet-topic", [`stellar:testnet:${address}`]),
        makeSession("no-signing-topic", undefined, []),
        makeSession("selected-topic"),
        makeSession("unselected-topic"),
      ]);

      expect(yield* client.reconnect(address)).toEqual({ address });
      expect(yield* client.signTransaction(signInput)).toEqual({
        signedTxXdr: "signed-xdr",
      });
      expect(signClient.state.requests).toEqual([
        {
          topic: "selected-topic",
          chainId: "stellar:pubnet",
          request: {
            method: "stellar_signXDR",
            params: { xdr: "unsigned-xdr" },
          },
        },
      ]);
      yield* client.disconnect;
      expect(signClient.state.disconnects).toEqual(["selected-topic"]);
      expect(
        yield* Effect.flip(client.signTransaction(signInput))
      ).toMatchObject({
        operation: "stellar-sign-transaction",
      });
      expect(signClient.state.proposals).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.effect("rejects a session at its expiry boundary", () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const { client, signClient } = yield* makeWalletConnectClient([
        { ...makeSession("expired-topic"), expiry: now / 1000 },
      ]);

      expect(yield* Effect.flip(client.reconnect(address))).toMatchObject({
        operation: "stellar-reconnect",
      });
      expect(
        yield* Effect.flip(client.signTransaction(signInput))
      ).toMatchObject({
        operation: "stellar-sign-transaction",
      });
      expect(signClient.state.requests).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.effect(
    "does not replace a revoked selection with another account session",
    () =>
      Effect.gen(function* () {
        const { client, signClient } = yield* makeWalletConnectClient([
          makeSession("selected-topic"),
        ]);
        yield* client.reconnect(address);
        signClient.state.sessions = [makeSession("replacement-topic")];

        expect(
          yield* Effect.flip(client.signTransaction(signInput))
        ).toMatchObject({
          operation: "stellar-sign-transaction",
        });
        yield* client.disconnect;
        expect(signClient.state.requests).toEqual([]);
        expect(signClient.state.disconnects).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.effect("rejects signing for a different address or network", () =>
    Effect.gen(function* () {
      const { client, signClient } = yield* makeWalletConnectClient([
        makeSession("selected-topic"),
      ]);
      yield* client.reconnect(address);

      expect(
        yield* Effect.flip(
          client.signTransaction({ ...signInput, address: "another-address" })
        )
      ).toMatchObject({ operation: "stellar-sign-transaction" });
      expect(
        yield* Effect.flip(
          client.signTransaction({
            ...signInput,
            networkPassphrase: "Test SDF Network ; September 2015",
          })
        )
      ).toMatchObject({ operation: "stellar-sign-transaction" });
      expect(signClient.state.requests).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.effect("rejects malformed signed XDR responses", () =>
    Effect.gen(function* () {
      const { client, signClient } = yield* makeWalletConnectClient([
        makeSession("selected-topic"),
      ]);
      signClient.state.respond = async () => ({ signedXDR: 42 });
      yield* client.reconnect(address);

      expect(
        yield* Effect.flip(client.signTransaction(signInput))
      ).toMatchObject({
        _tag: "WalletIntegrationError",
        operation: "stellar-sign-transaction",
      });
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("rejects approved sessions without mainnet signing permission", () =>
    Effect.gen(function* () {
      const { client, modal, signClient } = yield* makeWalletConnectClient();
      const connecting = yield* client.connect.pipe(Effect.forkScoped);
      yield* Queue.take(modal.opened);
      signClient.approve(makeSession("invalid-approval", undefined, []));

      expect(yield* Effect.flip(Fiber.join(connecting))).toMatchObject({
        operation: "stellar-wallet-connect-approval",
      });
      expect(
        yield* Effect.flip(client.signTransaction(signInput))
      ).toMatchObject({
        operation: "stellar-sign-transaction",
      });
      expect(signClient.state.requests).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "resumes a dismissed proposal and signs through its approved session",
    () =>
      Effect.gen(function* () {
        const { client, modal, signClient } = yield* makeWalletConnectClient();
        const first = yield* client.connect.pipe(Effect.forkScoped);
        const uri = yield* Queue.take(modal.opened);
        yield* Effect.promise(() => modal.modal.close());
        expect(yield* Effect.flip(Fiber.join(first))).toMatchObject({
          cause: { code: 4001 },
        });

        const retry = yield* client.connect.pipe(Effect.forkScoped);
        expect(yield* Queue.take(modal.opened)).toBe(uri);
        expect(signClient.state.proposals).toEqual([
          {
            requiredNamespaces: {
              stellar: {
                chains: ["stellar:pubnet"],
                methods: ["stellar_signXDR"],
                events: [],
              },
            },
            optionalNamespaces: {
              stellar: {
                chains: ["stellar:pubnet"],
                methods: [
                  "stellar_signAndSubmitXDR",
                  "stellar_signAuthEntry",
                  "stellar_signMessage",
                ],
                events: [],
              },
            },
          },
        ]);
        signClient.approve(makeSession("approved-topic"));
        expect(yield* Fiber.join(retry)).toEqual({ address });
        expect(yield* client.signTransaction(signInput)).toEqual({
          signedTxXdr: "signed-xdr",
        });
        expect(signClient.state.requests[0]?.topic).toBe("approved-topic");
        expect(signClient.state.disconnects).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "keeps a newer selection and another ecosystem dialog after late approval",
    () =>
      Effect.gen(function* () {
        const { client, modal, presentation, signClient } =
          yield* makeWalletConnectClient([makeSession("restored-topic")]);
        const walletModal = yield* WalletModal;
        yield* walletModal.openConnect;
        const first = yield* client.connect.pipe(Effect.forkScoped);
        yield* Queue.take(modal.opened);
        yield* walletModal.connectOpen.set(false);
        expect(yield* Effect.flip(Fiber.join(first))).toMatchObject({
          cause: { code: 4001 },
        });

        yield* client.reconnect(address);
        yield* presentation
          .connect({
            connection: Effect.never,
            subscribeUri: (publish) =>
              Effect.sync(() => publish("wc:solana-proposal@2")),
          })
          .pipe(Effect.forkScoped);
        expect(yield* Queue.take(modal.opened)).toBe("wc:solana-proposal@2");
        signClient.approve(makeSession("late-topic"));
        yield* Effect.yieldNow;

        expect(modal.state.visible).toBe("wc:solana-proposal@2");
        expect(yield* client.signTransaction(signInput)).toEqual({
          signedTxXdr: "signed-xdr",
        });
        expect(signClient.state.requests[0]?.topic).toBe("restored-topic");
        expect(signClient.state.disconnects).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "settles a pending connect as cancelled when a restore supersedes it",
    () =>
      Effect.gen(function* () {
        const { client, modal, signClient } = yield* makeWalletConnectClient([
          makeSession("restored-topic"),
        ]);
        const first = yield* client.connect.pipe(Effect.forkScoped);
        yield* Queue.take(modal.opened);

        expect(yield* client.reconnect(address)).toEqual({ address });
        expect(
          yield* Effect.flip(Fiber.join(first)).pipe(Effect.timeout("1 second"))
        ).toMatchObject({ operation: "stellar-wallet-connect-cancelled" });

        signClient.approve(makeSession("late-topic"));
        yield* Effect.yieldNow;
        expect(yield* client.signTransaction(signInput)).toEqual({
          signedTxXdr: "signed-xdr",
        });
        expect(signClient.state.requests[0]?.topic).toBe("restored-topic");
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "settles a pending connect as cancelled when a disconnect supersedes it",
    () =>
      Effect.gen(function* () {
        const { client, modal, signClient } = yield* makeWalletConnectClient();
        const first = yield* client.connect.pipe(Effect.forkScoped);
        yield* Queue.take(modal.opened);

        yield* client.disconnect;
        expect(
          yield* Effect.flip(Fiber.join(first)).pipe(Effect.timeout("1 second"))
        ).toMatchObject({ operation: "stellar-wallet-connect-cancelled" });

        signClient.approve(makeSession("late-topic"));
        yield* Effect.yieldNow;
        expect(
          yield* Effect.flip(client.signTransaction(signInput))
        ).toMatchObject({ operation: "stellar-sign-transaction" });
        expect(signClient.state.requests).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("cancels a pending connect when the client is disposed", () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      const { modal, protocol, signClient } = yield* makeTestWalletConnect(
        makeFakeSignClient()
      );
      const client = yield* makeWalletConnectStellarWalletClient(protocol).pipe(
        Effect.provideService(Scope.Scope, scope)
      );
      const first = yield* client.connect.pipe(Effect.forkScoped);
      yield* Queue.take(modal.opened);

      yield* Scope.close(scope, Exit.void);
      expect(
        yield* Effect.flip(Fiber.join(first)).pipe(Effect.timeout("1 second"))
      ).toMatchObject({ operation: "stellar-wallet-connect-cancelled" });

      signClient.approve(makeSession("late-topic"));
      yield* Effect.yieldNow;
      expect(
        yield* Effect.flip(client.signTransaction(signInput))
      ).toMatchObject({ operation: "stellar-sign-transaction" });
      expect(signClient.state.requests).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.effect(
    "reports a wallet-side session end as a wagmi disconnect of the Stellar connector",
    () =>
      Effect.gen(function* () {
        const { client, signClient } = yield* makeWalletConnectClient([
          makeSession("selected-topic"),
          makeSession("other-topic"),
        ]);
        const storage = new Map<string, unknown>([
          [
            "stellar.reconnect",
            { address, connectorId: "stellar-wallet-connect" },
          ],
        ]);
        const emitter = { emit: vi.fn() };
        const runWalletEffect = yield* FiberSet.makeRuntimePromise();
        const wallet = getStellarConnectors({
          clients: [client],
          runWalletEffect,
        }).wallets[0]?.({} as never);
        if (!wallet) return yield* Effect.die("Stellar wallet missing");
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
        } as never) as unknown as Connector & {
          connect: (input?: { isReconnecting?: boolean }) => Promise<unknown>;
        };
        yield* Effect.promise(() =>
          connector.connect({ isReconnecting: true })
        );

        signClient.end("other-topic");
        expect(emitter.emit).not.toHaveBeenCalledWith("disconnect");

        signClient.end("selected-topic");
        yield* Effect.promise(() => Promise.resolve());

        expect(emitter.emit).toHaveBeenCalledWith("disconnect");
        expect(yield* Effect.promise(() => connector.getAccounts())).toEqual(
          []
        );
        expect(storage.has("stellar.reconnect")).toBe(false);
        expect(signClient.state.disconnects).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.effect(
    "releases local selection without destroying persisted native sessions",
    () =>
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        const { protocol, signClient } = yield* makeTestWalletConnect(
          makeFakeSignClient({ sessions: [makeSession("restored-topic")] })
        );
        const client = yield* makeWalletConnectStellarWalletClient(
          protocol
        ).pipe(Effect.provideService(Scope.Scope, scope));
        yield* client.reconnect(address);
        yield* Scope.close(scope, Exit.void);

        expect(
          yield* Effect.flip(client.signTransaction(signInput))
        ).toMatchObject({
          operation: "stellar-sign-transaction",
        });
        expect(yield* Effect.flip(client.connect)).toMatchObject({
          operation: "stellar-wallet-connect-cancelled",
        });
        expect(signClient.state.disconnects).toEqual([]);
        expect(signClient.state.requests).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );
});
