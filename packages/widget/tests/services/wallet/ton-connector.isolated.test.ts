import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import type { Connector } from "wagmi";

import { getTonConnectors } from "../../../src/services/wallet/internal/adapters/ton/ton-connector";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import { runWalletEffect } from "../../utils/run-wallet-effect";

type ModalState =
  | { readonly status: "opened"; readonly closeReason: null }
  | {
      readonly status: "closed";
      readonly closeReason: "action-cancelled" | "wallet-selected" | null;
    };

type FakeWallet = { readonly account: { readonly address: string } };

/** Stands in for TonConnect's UI SDK, which renders its own modal. */
const tonConnect = vi.hoisted(() => {
  const statusListeners = new Set<(wallet: FakeWallet | null) => void>();
  const modalListeners = new Set<(state: ModalState) => void>();
  const emitModal = (state: ModalState) => {
    for (const listener of modalListeners) listener(state);
  };
  return {
    emitModal,
    emitStatus: (wallet: FakeWallet | null) => {
      for (const listener of statusListeners) listener(wallet);
    },
    openModal: vi.fn(async () => {
      emitModal({ status: "opened", closeReason: null });
    }),
    /** Answers with an empty cell as the signed external message. */
    sendTransaction: vi.fn(async (_request: unknown) => ({
      boc: "te6cckEBAQEAAgAAAEysuc0=",
    })),
    reset: () => {
      statusListeners.clear();
      modalListeners.clear();
    },
    statusListeners,
    modalListeners,
  };
});

vi.mock("@tonconnect/ui", () => ({
  TonConnectUI: class {
    readonly connectionRestored = Promise.resolve(false);
    readonly openModal = tonConnect.openModal;
    readonly sendTransaction = tonConnect.sendTransaction;
    onStatusChange(listener: (wallet: FakeWallet | null) => void) {
      tonConnect.statusListeners.add(listener);
      return () => tonConnect.statusListeners.delete(listener);
    }
    onModalStateChange(listener: (state: ModalState) => void) {
      tonConnect.modalListeners.add(listener);
      return () => tonConnect.modalListeners.delete(listener);
    }
    async disconnect() {}
  },
  toUserFriendlyAddress: (address: string) => `friendly:${address}`,
}));

type TonConnector = Connector & {
  connect: () => Promise<{ accounts: ReadonlyArray<string> }>;
  signTransaction: (tx: string) => Effect.Effect<string, Error>;
};

/** An internal transfer of 123 nanotons to the zero address, commented "Deposit". */
const tonInternalMessage =
  "te6cckEBAQEAPgAAeGIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL2AAAAAAAAAAAAAAAAAAAAAAARGVwb3NpdD094WI=";
/** An inbound external message to the zero address. */
const tonExternalMessage =
  "te6cckEBAQEAJQAARYgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEuN2rAw==";

const makeConnector = Effect.gen(function* () {
  tonConnect.reset();
  tonConnect.openModal.mockClear();
  tonConnect.sendTransaction.mockClear();
  const walletModal = yield* WalletModal;
  const wallet = getTonConnectors({
    runWalletEffect,
    tonConnectManifestUrl: undefined,
    walletModal,
  }).wallets[0];
  if (!wallet) throw new Error("TonConnect wallet missing");
  const connector = wallet({} as never).createConnector({} as never)({
    emitter: { emit: vi.fn() },
    storage: { getItem: vi.fn(), removeItem: vi.fn(), setItem: vi.fn() },
  } as never) as unknown as TonConnector;
  return { connector, walletModal };
});

const presentationOpen = (walletModal: WalletModal["Service"]) =>
  runWalletEffect(walletModal.presentationOpen.current);

describe("TonConnect connector", () => {
  it.effect(
    "suspends the picker while TonConnect's modal is open and restores it when the modal closes without a wallet",
    () =>
      Effect.gen(function* () {
        const { connector, walletModal } = yield* makeConnector;

        const settled = connector.connect().then(
          () => "connected",
          () => "cancelled"
        );
        yield* Effect.promise(() =>
          expect.poll(() => presentationOpen(walletModal)).toBe(true)
        );
        expect(tonConnect.openModal).toHaveBeenCalledOnce();

        tonConnect.emitModal({
          status: "closed",
          closeReason: "action-cancelled",
        });
        expect(yield* Effect.promise(() => settled)).toBe("cancelled");
        yield* Effect.promise(() =>
          expect.poll(() => presentationOpen(walletModal)).toBe(false)
        );
      }).pipe(Effect.provide(WalletModal.layer))
  );

  it.effect(
    "keeps the picker suspended until the selected wallet's connection settles",
    () =>
      Effect.gen(function* () {
        const { connector, walletModal } = yield* makeConnector;

        const connecting = connector.connect();
        yield* Effect.promise(() =>
          expect.poll(() => presentationOpen(walletModal)).toBe(true)
        );

        tonConnect.emitStatus({ account: { address: "ton-address" } });
        tonConnect.emitModal({
          status: "closed",
          closeReason: "wallet-selected",
        });
        const result = yield* Effect.promise(() => connecting);
        expect(result.accounts).toEqual(["friendly:ton-address"]);
        expect(yield* walletModal.presentationOpen.current).toBe(false);
      }).pipe(Effect.provide(WalletModal.layer))
  );

  it.effect(
    "restores the picker when TonConnect's modal closes outside a connection",
    () =>
      Effect.gen(function* () {
        const { connector, walletModal } = yield* makeConnector;
        tonConnect.emitStatus({ account: { address: "ton-address" } });
        yield* Effect.promise(() => connector.connect());
        expect(tonConnect.openModal).not.toHaveBeenCalled();

        tonConnect.emitModal({ status: "opened", closeReason: null });
        yield* Effect.promise(() =>
          expect.poll(() => presentationOpen(walletModal)).toBe(true)
        );
        tonConnect.emitModal({
          status: "closed",
          closeReason: "action-cancelled",
        });
        yield* Effect.promise(() =>
          expect.poll(() => presentationOpen(walletModal)).toBe(false)
        );
      }).pipe(Effect.provide(WalletModal.layer))
  );

  it.effect(
    "leaves a suspension it did not start when TonConnect's modal closes",
    () =>
      Effect.gen(function* () {
        const { walletModal } = yield* makeConnector;
        yield* walletModal.presentationOpen.set(true);

        tonConnect.emitModal({
          status: "closed",
          closeReason: "action-cancelled",
        });
        yield* Effect.yieldNow;

        expect(yield* walletModal.presentationOpen.current).toBe(true);
      }).pipe(Effect.provide(WalletModal.layer))
  );

  it.effect(
    "sends a TON message as its raw transfer and returns the signed message hash",
    () =>
      Effect.gen(function* () {
        const { connector } = yield* makeConnector;
        tonConnect.emitStatus({ account: { address: "ton-address" } });

        const hash = yield* connector.signTransaction(
          JSON.stringify({ seqno: 0, message: tonInternalMessage })
        );

        expect(hash).toBe(
          "96a296d224f285c67bee93c30f8a309157f0daa35dc5b87e410b78630a09cfc7"
        );
        expect(tonConnect.sendTransaction).toHaveBeenCalledOnce();
        expect(tonConnect.sendTransaction.mock.calls[0]?.[0]).toMatchObject({
          messages: [
            {
              address: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
              amount: "123",
              payload: "te6cckEBAQEADQAAFgAAAABEZXBvc2l0CC6i0Q==",
            },
          ],
        });
      }).pipe(Effect.provide(WalletModal.layer))
  );

  it.effect(
    "fails a TON message that is not an internal transfer before sending it",
    () =>
      Effect.gen(function* () {
        const { connector } = yield* makeConnector;
        tonConnect.emitStatus({ account: { address: "ton-address" } });

        const failure = yield* Effect.flip(
          connector.signTransaction(
            JSON.stringify({ seqno: 0, message: tonExternalMessage })
          )
        );

        expect(failure).toMatchObject({
          _tag: "WalletIntegrationError",
          operation: "ton-decode-message",
        });
        expect(tonConnect.sendTransaction).not.toHaveBeenCalled();
      }).pipe(Effect.provide(WalletModal.layer))
  );
});
