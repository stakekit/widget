import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Fiber, FiberSet, Queue } from "effect";
import type { Connector } from "wagmi";
import { makeTronWalletDriver } from "../../../src/services/wallet/internal/adapters/tron/driver";
import { getTronConnectors } from "../../../src/services/wallet/internal/adapters/tron/tron-connector";
import type { WalletConnectProtocol } from "../../../src/services/wallet/internal/platform/wallet-connect-protocol";
import { isWalletCancellation } from "../../../src/services/wallet/wallet-cancellation";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import {
  type FakeSignClient,
  makeFakeSignClient,
  makeTestWalletConnect,
  walletConnectSession,
} from "../../utils/wallet-connect";

const mainnet = "tron:0x2b6653dc";
const address = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
const nileAddress = "TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL";
const uri = "wc:proposal-1@2?relay-protocol=irn&symKey=00";

const unsigned = {
  raw_data: {
    contract: [{ type: "TransferContract" }],
    expiration: 1,
    ref_block_bytes: "00",
    ref_block_hash: "00",
    timestamp: 1,
  },
  raw_data_hex: "00",
  txID: "tron-id",
  visible: false,
};
const signed = { ...unsigned, signature: ["signature"] };

const tronSession = (
  input: {
    readonly topic?: string;
    readonly accounts?: ReadonlyArray<string>;
    readonly sessionProperties?: Record<string, string>;
  } = {}
) => ({
  ...walletConnectSession({
    topic: input.topic ?? "tron-session",
    namespace: "tron",
    accounts: input.accounts ?? [`${mainnet}:${address}`],
    methods: ["tron_signTransaction", "tron_signMessage"],
  }),
  ...(input.sessionProperties && {
    sessionProperties: input.sessionProperties,
  }),
});

const solanaSession = walletConnectSession({
  topic: "solana-session",
  namespace: "solana",
  accounts: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:payer"],
});

type TronWcConnector = Connector & {
  connect: (input?: { isReconnecting?: boolean }) => Promise<{
    accounts: ReadonlyArray<string>;
    chainId: number;
  }>;
  signTransaction: (transaction: typeof unsigned) => Promise<unknown>;
};

/** wagmi storage over a Map, exposing its values for assertions. */
type FakeStorage = Readonly<{
  values: Map<string, unknown>;
  getItem: (key: string) => Promise<unknown>;
  setItem: (key: string, value: unknown) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}>;

const makeStorage = (): FakeStorage => {
  const values = new Map<string, unknown>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: unknown) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
};

const makeConnector = Effect.fn("makeTronWcConnector")(function* ({
  protocol,
  storage = makeStorage(),
}: {
  readonly protocol: WalletConnectProtocol;
  readonly storage?: FakeStorage;
}) {
  const runWalletEffect = yield* FiberSet.makeRuntimePromise();
  const group = getTronConnectors({
    walletConnectProtocol: protocol,
    runWalletEffect,
  });
  const wallet = group.wallets
    .map((createWallet) => createWallet({} as never))
    .find((candidate) => candidate.id === "tronWc");
  if (!wallet) return yield* Effect.die("Tron WalletConnect wallet missing");
  const emitter = { emit: vi.fn() };
  const connector = wallet.createConnector({} as never)({
    emitter,
    storage,
  } as never) as unknown as TronWcConnector;
  return { connector, emitter, storage };
});

const makeFixture = Effect.fn("makeTronWcFixture")(function* (
  options: {
    readonly sessions?: ReadonlyArray<unknown>;
    readonly request?: FakeSignClient["state"]["respond"];
    readonly storage?: FakeStorage;
  } = {}
) {
  const walletConnect = yield* makeTestWalletConnect(
    makeFakeSignClient({ sessions: options.sessions, request: options.request })
  );
  const wagmi = yield* makeConnector({
    protocol: walletConnect.protocol,
    storage: options.storage,
  });
  return { ...walletConnect, ...wagmi };
});

const connect = (connector: TronWcConnector) =>
  Effect.tryPromise(() => connector.connect());

describe("Tron WalletConnect connector", () => {
  it.live(
    "presents the proposal URI and resolves the approved mainnet account",
    () =>
      Effect.gen(function* () {
        const { connector, modal, signClient } = yield* makeFixture();
        const connecting = yield* connect(connector).pipe(
          Effect.forkScoped({ startImmediately: true })
        );
        expect(yield* Queue.take(modal.opened)).toBe(uri);
        expect(signClient.state.proposals).toEqual([
          {
            optionalNamespaces: {
              tron: {
                chains: [mainnet],
                methods: ["tron_signTransaction", "tron_signMessage"],
                events: [],
              },
            },
          },
        ]);
        signClient.approve(
          tronSession({
            accounts: [
              `tron:0xcd8690dc:${nileAddress}`,
              `${mainnet}:${address}`,
            ],
          })
        );

        expect(yield* Fiber.join(connecting)).toMatchObject({
          accounts: [address],
        });
        expect(yield* Effect.promise(() => connector.getAccounts())).toEqual([
          address,
        ]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live(
    "treats QR dismissal as a cancellation and resumes the same proposal on retry",
    () =>
      Effect.gen(function* () {
        const { connector, modal, signClient } = yield* makeFixture();
        const first = yield* connect(connector).pipe(
          Effect.forkScoped({ startImmediately: true })
        );
        expect(yield* Queue.take(modal.opened)).toBe(uri);
        yield* Effect.promise(() => modal.modal.close());
        expect(
          isWalletCancellation(yield* Effect.flip(Fiber.join(first)))
        ).toBe(true);

        const retry = yield* connect(connector).pipe(
          Effect.forkScoped({ startImmediately: true })
        );
        expect(yield* Queue.take(modal.opened)).toBe(uri);
        signClient.approve(tronSession());

        expect(yield* Fiber.join(retry)).toMatchObject({ accounts: [address] });
        expect(signClient.state.proposals).toHaveLength(1);
        expect(signClient.state.disconnects).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("restores an unexpired Tron session after reload without a QR", () =>
    Effect.gen(function* () {
      const { connector, signClient } = yield* makeFixture({
        sessions: [solanaSession, tronSession()],
      });

      expect(yield* Effect.promise(() => connector.isAuthorized())).toBe(true);
      expect(
        yield* Effect.promise(() => connector.connect({ isReconnecting: true }))
      ).toMatchObject({ accounts: [address] });
      expect(signClient.state.proposals).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("does not restore without a session on the Tron mainnet chain", () =>
    Effect.gen(function* () {
      const { connector, signClient } = yield* makeFixture({
        sessions: [
          solanaSession,
          tronSession({ accounts: [`tron:0xcd8690dc:${nileAddress}`] }),
        ],
      });

      expect(yield* Effect.promise(() => connector.isAuthorized())).toBe(false);
      yield* Effect.flip(
        Effect.tryPromise(() => connector.connect({ isReconnecting: true }))
      );
      expect(signClient.state.proposals).toEqual([]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("does not restore after the user disconnected", () =>
    Effect.gen(function* () {
      const storage = makeStorage();
      const session = tronSession();
      const before = yield* makeFixture({ sessions: [session], storage });
      yield* Effect.promise(() => before.connector.connect());
      yield* Effect.promise(() => before.connector.disconnect());
      expect(storage.values.get("tron.disconnected")).toBe(true);

      // A session the wallet still advertises must not override the choice.
      const after = yield* makeFixture({ sessions: [session], storage });
      expect(yield* Effect.promise(() => after.connector.isAuthorized())).toBe(
        false
      );
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("emits a wagmi disconnect when the wallet ends the session", () =>
    Effect.gen(function* () {
      const { connector, emitter, signClient } = yield* makeFixture({
        sessions: [tronSession()],
      });
      yield* Effect.promise(() => connector.connect({ isReconnecting: true }));

      signClient.end("tron-session");

      expect(emitter.emit).toHaveBeenCalledWith("disconnect");
      expect(signClient.endedSubscribers()).toBe(1);
      yield* Effect.flip(Effect.tryPromise(() => connector.getAccounts()));
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("signs with the nested transaction params and unwraps result", () =>
    Effect.gen(function* () {
      const { connector, signClient } = yield* makeFixture({
        sessions: [tronSession()],
        request: async () => ({ result: signed }),
      });
      yield* Effect.promise(() => connector.connect({ isReconnecting: true }));

      expect(
        yield* Effect.promise(() => connector.signTransaction(unsigned))
      ).toEqual(signed);
      expect(signClient.state.requests).toEqual([
        {
          topic: "tron-session",
          chainId: mainnet,
          request: {
            method: "tron_signTransaction",
            params: { address, transaction: { transaction: unsigned } },
          },
        },
      ]);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("keeps wallet fields the codec does not declare", () =>
    Effect.gen(function* () {
      const extended = {
        ...signed,
        ret: [{ contractRet: "SUCCESS" }],
        raw_data: { ...signed.raw_data, ref_block_num: 7 },
      };
      const { connector } = yield* makeFixture({
        sessions: [tronSession()],
        request: async () => ({ result: extended }),
      });
      yield* Effect.promise(() => connector.connect({ isReconnecting: true }));

      const result = yield* makeTronWalletDriver({ connector }).signTransaction(
        {
          tx: JSON.stringify(unsigned),
        }
      );

      expect(JSON.parse(result.signedTx)).toEqual(extended);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("signs with v1 params when the wallet declares them", () =>
    Effect.gen(function* () {
      const { connector, signClient } = yield* makeFixture({
        sessions: [
          tronSession({ sessionProperties: { tron_method_version: "v1" } }),
        ],
        request: async () => signed,
      });
      yield* Effect.promise(() => connector.connect({ isReconnecting: true }));

      const result = yield* makeTronWalletDriver({ connector }).signTransaction(
        {
          tx: JSON.stringify(unsigned),
        }
      );

      expect(result.broadcasted).toBe(false);
      expect(JSON.parse(result.signedTx)).toEqual(signed);
      expect(signClient.state.requests[0]?.request.params).toEqual({
        address,
        transaction: unsigned,
      });
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("surfaces a wallet rejection as a cancellation", () =>
    Effect.gen(function* () {
      const { connector } = yield* makeFixture({
        sessions: [tronSession()],
        request: async () => {
          throw { code: 4001, message: "User rejected" };
        },
      });
      yield* Effect.promise(() => connector.connect({ isReconnecting: true }));

      const error = yield* Effect.flip(
        makeTronWalletDriver({ connector }).signTransaction({
          tx: JSON.stringify(unsigned),
        })
      );

      expect(isWalletCancellation(error)).toBe(true);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("rejects a malformed signing response", () =>
    Effect.gen(function* () {
      const { connector } = yield* makeFixture({
        sessions: [tronSession()],
        request: async () => ({ result: "0xsignature" }),
      });
      yield* Effect.promise(() => connector.connect({ isReconnecting: true }));

      const error = yield* Effect.flip(
        makeTronWalletDriver({ connector }).signTransaction({
          tx: JSON.stringify(unsigned),
        })
      );

      expect(isWalletCancellation(error)).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );

  it.live("disconnects only its own session", () =>
    Effect.gen(function* () {
      const { connector, signClient } = yield* makeFixture({
        sessions: [solanaSession, tronSession()],
      });
      yield* Effect.promise(() => connector.connect({ isReconnecting: true }));

      yield* Effect.promise(() => connector.disconnect());

      expect(signClient.state.disconnects).toEqual(["tron-session"]);
      expect(signClient.state.sessions).toEqual([solanaSession]);
      expect(signClient.endedSubscribers()).toBe(1);
      yield* Effect.flip(Effect.tryPromise(() => connector.getAccounts()));
    }).pipe(Effect.scoped, Effect.provide(WalletModal.layer))
  );
});
