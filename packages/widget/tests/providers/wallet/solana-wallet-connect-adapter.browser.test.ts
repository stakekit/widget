import { describe, expect, it } from "@effect/vitest";
import {
  WalletAdapterNetwork,
  WalletSignTransactionError,
} from "@solana/wallet-adapter-base";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import base58 from "bs58";
import { Effect, Fiber, FiberSet, Queue, Schema } from "effect";
import { vi } from "vitest";
import { getSolanaConnectors } from "../../../src/services/wallet/internal/adapters/solana/solana-connector";
import { WalletConnectSolanaAdapter } from "../../../src/services/wallet/internal/runtime/solana-wallet-connect-adapter";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import {
  type FakeSignClient,
  makeFakeSignClient,
  makeTestWalletConnect,
  walletConnectSession,
} from "../../utils/wallet-connect";

const payer = Keypair.fromSeed(new Uint8Array(32).fill(1));
const cosigner = Keypair.fromSeed(new Uint8Array(32).fill(2));
const chainId = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const account = `${chainId}:${payer.publicKey.toBase58()}`;
const sessionMethods = ["solana_signTransaction", "solana_signMessage"];
const uri = "wc:proposal-1@2?relay-protocol=irn&symKey=00";

const transactions = () => {
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: cosigner.publicKey,
      lamports: 1,
    }),
    new TransactionInstruction({
      programId: SystemProgram.programId,
      keys: [{ pubkey: cosigner.publicKey, isSigner: true, isWritable: false }],
    }),
  ];
  const legacy = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: SystemProgram.programId.toBase58(),
  }).add(...instructions);
  legacy.partialSign(cosigner);
  const versioned = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: SystemProgram.programId.toBase58(),
      instructions,
    }).compileToV0Message()
  );
  versioned.sign([cosigner]);
  return { legacy, versioned };
};

const makeFixture = Effect.fn("makeSolanaWalletConnectFixture")(function* (
  options: {
    readonly restored?: boolean;
    readonly sessions?: ReadonlyArray<unknown>;
    readonly methods?: string[];
    readonly request?: FakeSignClient["state"]["respond"];
  } = {}
) {
  const approvedSession = walletConnectSession({
    topic: "solana-session",
    namespace: "solana",
    accounts: [account],
    methods: options.methods ?? sessionMethods,
  });
  const { modal, presentation, protocol, signClient } =
    yield* makeTestWalletConnect(
      makeFakeSignClient({
        sessions:
          options.sessions ?? (options.restored ? [approvedSession] : []),
        request: options.request,
      })
    );
  const state = { connected: 0, disconnected: 0 };
  const runWalletEffect = yield* FiberSet.makeRuntimePromise();
  const adapter = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new WalletConnectSolanaAdapter({
          network: WalletAdapterNetwork.Mainnet,
          walletConnectProtocol: protocol,
          runWalletEffect,
        })
    ),
    (adapter) => Effect.sync(() => adapter.destroy())
  );
  adapter.on("connect", () => {
    state.connected++;
  });
  adapter.on("disconnect", () => {
    state.disconnected++;
  });
  const storage = new Map<string, unknown>([
    ["recentConnectorId", adapter.name],
  ]);
  const emitter = { emit: vi.fn() };
  const wallet = getSolanaConnectors({
    wallets: [
      {
        adapter,
        isPresent: () => true,
        readyState: adapter.readyState,
        source: "fallback",
      },
    ],
    connection: new Connection("https://solana.test"),
    variant: "default",
  }).wallets[0]?.({} as never);
  if (!wallet) return yield* Effect.die("Solana WalletConnect wallet missing");
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
  } as never);
  return {
    adapter,
    approvedSession,
    connector,
    emitter,
    modal,
    opened: modal.opened,
    presentation,
    signClient,
    state,
  };
});

const TransactionRequest = Schema.Struct({ transaction: Schema.String });
const BatchRequest = Schema.Struct({
  transactions: Schema.Array(Schema.String),
});

const signSerialized = (serialized: string) => {
  const bytes = Buffer.from(serialized, "base64");
  const versioned = VersionedTransaction.deserialize(bytes);
  if (versioned.version === 0) {
    versioned.sign([payer]);
    return Buffer.from(versioned.serialize()).toString("base64");
  }
  const legacy = Transaction.from(bytes);
  legacy.partialSign(payer);
  return legacy.serialize().toString("base64");
};

describe("Solana WalletConnect protocol adapter", () => {
  it.live(
    "releases a cancelled handoff for another ecosystem and keeps late approval out of adapter state",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture();
        const walletModal = yield* WalletModal;
        const first = Effect.tryPromise(() => fixture.adapter.connect()).pipe(
          Effect.exit
        );
        const connecting = yield* first.pipe(Effect.forkScoped());
        expect(yield* Queue.take(fixture.opened)).toBe(uri);
        yield* walletModal.connectOpen.set(false);
        yield* Fiber.join(connecting);
        expect(fixture.adapter.connecting).toBe(false);
        expect(fixture.adapter.publicKey).toBeNull();

        const other = yield* fixture.presentation
          .connect({
            namespace: "eip155",
            connection: Effect.never,
            subscribeUri: (publish) =>
              Effect.sync(() => publish("wc:evm-proposal@2")),
          })
          .pipe(Effect.forkScoped());
        expect(yield* Queue.take(fixture.opened)).toBe("wc:evm-proposal@2");
        fixture.signClient.approve(fixture.approvedSession);
        yield* Effect.yieldNow;
        expect(fixture.adapter.publicKey).toBeNull();
        expect(fixture.state.connected).toBe(0);
        expect(fixture.modal.state.visible).toBe("wc:evm-proposal@2");
        yield* Fiber.interrupt(other);

        yield* Effect.promise(() => fixture.adapter.connect());
        expect(fixture.adapter.publicKey?.toBase58()).toBe(
          payer.publicKey.toBase58()
        );
        expect(fixture.signClient.state.proposals).toHaveLength(1);
        expect(fixture.state.connected).toBe(1);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("does not activate an approval after adapter disposal", () =>
    Effect.gen(function* () {
      const fixture = yield* makeFixture();
      const connecting = yield* Effect.tryPromise(() =>
        fixture.adapter.connect()
      ).pipe(Effect.exit, Effect.forkScoped());
      yield* Queue.take(fixture.opened);
      fixture.adapter.destroy();
      fixture.signClient.approve(fixture.approvedSession);
      yield* Fiber.join(connecting);
      expect(fixture.adapter.connected).toBe(false);
      expect(fixture.adapter.connecting).toBe(false);
      expect(fixture.state.connected).toBe(0);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "restores a persisted session on reload and reports a wallet-side end as a wagmi disconnect",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({ restored: true });
        expect(
          yield* Effect.promise(() => fixture.connector.isAuthorized())
        ).toBe(true);
        expect(
          yield* Effect.promise(() => fixture.connector.getAccounts())
        ).toEqual([payer.publicKey.toBase58()]);
        expect(fixture.signClient.state.proposals).toEqual([]);

        fixture.signClient.end("solana-session");

        expect(fixture.adapter.publicKey).toBeNull();
        expect(fixture.emitter.emit).toHaveBeenCalledWith("disconnect");
        expect(fixture.signClient.state.disconnects).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("does not report a user disconnect as a wallet-side end", () =>
    Effect.gen(function* () {
      const fixture = yield* makeFixture({ restored: true });
      yield* Effect.promise(() => fixture.connector.isAuthorized());
      yield* Effect.promise(() => fixture.connector.disconnect());

      expect(fixture.emitter.emit).not.toHaveBeenCalledWith("disconnect");
      expect(fixture.signClient.state.disconnects).toEqual(["solana-session"]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "skips a stored session with an invalid Solana address and restores the next valid one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({
          sessions: [
            walletConnectSession({
              topic: "invalid-address-session",
              namespace: "solana",
              accounts: [`${chainId}:0OIl0OIl`],
              methods: sessionMethods,
            }),
            walletConnectSession({
              topic: "solana-session",
              namespace: "solana",
              accounts: [account],
              methods: sessionMethods,
            }),
          ],
        });
        expect(
          yield* Effect.promise(() => fixture.connector.isAuthorized())
        ).toBe(true);
        expect(fixture.adapter.publicKey?.toBase58()).toBe(
          payer.publicKey.toBase58()
        );
        expect(fixture.signClient.state.proposals).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "round-trips partially signed legacy and v0 transactions without losing a cosigner",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({
          restored: true,
          request: async ({ request }) => ({
            transaction: signSerialized(
              Schema.decodeUnknownSync(TransactionRequest)(request.params)
                .transaction
            ),
          }),
        });
        yield* Effect.promise(() => fixture.adapter.connect());
        const { legacy, versioned } = transactions();
        const legacyCosignature = legacy.signatures.find(({ publicKey }) =>
          publicKey.equals(cosigner.publicKey)
        )?.signature;
        const v0Cosignature = versioned.signatures[1];
        const signedLegacy = yield* Effect.promise(() =>
          fixture.adapter.signTransaction(legacy)
        );
        const signedV0 = yield* Effect.promise(() =>
          fixture.adapter.signTransaction(versioned)
        );
        expect(signedLegacy).toBeInstanceOf(Transaction);
        expect(signedLegacy.verifySignatures()).toBe(true);
        expect(
          Array.from(
            signedLegacy.signatures.find(({ publicKey }) =>
              publicKey.equals(cosigner.publicKey)
            )!.signature!
          )
        ).toEqual(Array.from(legacyCosignature!));
        expect(signedV0).toBeInstanceOf(VersionedTransaction);
        expect(signedV0.signatures[1]).toEqual(v0Cosignature);
        const expected = transactions().versioned;
        expected.sign([payer]);
        expect(signedV0.serialize()).toEqual(expected.serialize());
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "supports signature-only responses and inherited legacy/v0 broadcasting",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({
          restored: true,
          request: async ({ request }) => {
            const serialized = Schema.decodeUnknownSync(TransactionRequest)(
              request.params
            ).transaction;
            const signed = VersionedTransaction.deserialize(
              Buffer.from(signSerialized(serialized), "base64")
            );
            return { signature: base58.encode(signed.signatures[0]!) };
          },
        });
        yield* Effect.promise(() => fixture.adapter.connect());
        const connection = new Connection("https://solana.test");
        const broadcast = vi
          .spyOn(connection, "sendRawTransaction")
          .mockResolvedValue("broadcast-signature");
        try {
          const { legacy, versioned } = transactions();
          for (const transaction of [legacy, versioned]) {
            const signature = yield* Effect.promise(() =>
              fixture.adapter.sendTransaction(transaction, connection, {
                skipPreflight: true,
              })
            );
            expect(signature).toBe("broadcast-signature");
            expect(broadcast).toHaveBeenLastCalledWith(
              transaction.serialize(),
              { skipPreflight: true }
            );
          }
          expect(legacy.verifySignatures()).toBe(true);
          const expected = transactions().versioned;
          expected.sign([payer]);
          expect(versioned.serialize()).toEqual(expected.serialize());
        } finally {
          broadcast.mockRestore();
        }
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "preserves mixed transaction types in batch signing and rejects incomplete wallet results",
    () =>
      Effect.gen(function* () {
        let truncate = false;
        const fixture = yield* makeFixture({
          restored: true,
          methods: [...sessionMethods, "solana_signAllTransactions"],
          request: async ({ request }) => {
            const { transactions } = Schema.decodeUnknownSync(BatchRequest)(
              request.params
            );
            return {
              transactions: (truncate
                ? transactions.slice(1)
                : transactions
              ).map(signSerialized),
            };
          },
        });
        yield* Effect.promise(() => fixture.adapter.connect());
        const { legacy, versioned } = transactions();
        const signed = yield* Effect.promise(() =>
          fixture.adapter.signAllTransactions([legacy, versioned])
        );
        expect(signed[0]).toBeInstanceOf(Transaction);
        expect(signed[1]).toBeInstanceOf(VersionedTransaction);
        expect(Buffer.from(signed[0]!.serialize()).toString("base64")).toBe(
          signSerialized(
            legacy.serialize({ requireAllSignatures: false }).toString("base64")
          )
        );
        expect(Buffer.from(signed[1]!.serialize()).toString("base64")).toBe(
          signSerialized(Buffer.from(versioned.serialize()).toString("base64"))
        );
        truncate = true;
        const failure = yield* Effect.flip(
          Effect.tryPromise({
            try: () => fixture.adapter.signAllTransactions([legacy, versioned]),
            catch: (cause) => ({ cause }),
          })
        );
        expect(failure.cause).toBeInstanceOf(WalletSignTransactionError);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "falls back to individual signing when the wallet does not approve batch signing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({
          restored: true,
          request: async ({ request }) => {
            if (request.method !== "solana_signTransaction")
              throw new Error("Batch method was not approved");
            return {
              transaction: signSerialized(
                Schema.decodeUnknownSync(TransactionRequest)(request.params)
                  .transaction
              ),
            };
          },
        });
        yield* Effect.promise(() => fixture.adapter.connect());
        const { legacy, versioned } = transactions();
        const [signedLegacy, signedV0] = yield* Effect.promise(() =>
          fixture.adapter.signAllTransactions([legacy, versioned])
        );
        expect(signedLegacy).toBeInstanceOf(Transaction);
        expect(signedV0).toBeInstanceOf(VersionedTransaction);
        expect(Buffer.from(signedLegacy!.serialize()).toString("base64")).toBe(
          signSerialized(
            legacy.serialize({ requireAllSignatures: false }).toString("base64")
          )
        );
        expect(Buffer.from(signedV0!.serialize()).toString("base64")).toBe(
          signSerialized(Buffer.from(versioned.serialize()).toString("base64"))
        );
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "encodes message bytes as base58 and decodes the wallet signature",
    () =>
      Effect.gen(function* () {
        const message = new Uint8Array([0, 255, 128, 42]);
        const signature = new Uint8Array(64).fill(9);
        const fixture = yield* makeFixture({
          restored: true,
          request: async ({ request }) => {
            const params = Schema.decodeUnknownSync(
              Schema.Struct({ pubkey: Schema.String, message: Schema.String })
            )(request.params);
            expect(params.pubkey).toBe(payer.publicKey.toBase58());
            expect(base58.decode(params.message)).toEqual(message);
            return { signature: base58.encode(signature) };
          },
        });
        yield* Effect.promise(() => fixture.adapter.connect());
        expect(
          yield* Effect.promise(() => fixture.adapter.signMessage(message))
        ).toEqual(signature);
        yield* Effect.promise(() => fixture.adapter.disconnect());
        expect(fixture.adapter.publicKey).toBeNull();
        expect(fixture.signClient.state.disconnects).toEqual([
          "solana-session",
        ]);
        expect(fixture.signClient.state.sessions).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );
});
