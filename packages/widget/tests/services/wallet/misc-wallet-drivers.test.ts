import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import type { Connector } from "wagmi";
import { makeCardanoWalletDriver } from "../../../src/services/wallet/internal/adapters/cardano/driver";
import { makeSolanaWalletDriver } from "../../../src/services/wallet/internal/adapters/solana/driver";
import { makeTonWalletDriver } from "../../../src/services/wallet/internal/adapters/ton/driver";
import { makeTronWalletDriver } from "../../../src/services/wallet/internal/adapters/tron/driver";

const tronTx = JSON.stringify({
  raw_data: {
    contract: [],
    expiration: 1,
    ref_block_bytes: "00",
    ref_block_hash: "00",
    timestamp: 1,
  },
  raw_data_hex: "00",
  txID: "tron-id",
  visible: true,
});

describe("non-EVM wallet drivers", () => {
  it.effect("normalizes a Tron signed transaction to a JSON payload", () =>
    Effect.gen(function* () {
      const signTransaction = vi.fn(async () => ({ txID: "signed" }));
      const connector = {
        id: "tronLink",
        signTransaction,
      } as unknown as Connector;

      expect(
        yield* makeTronWalletDriver({ connector }).signTransaction({
          tx: tronTx,
        })
      ).toEqual({
        broadcasted: false,
        signedTx: JSON.stringify({ txID: "signed" }),
      });
      expect(signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ txID: "tron-id" })
      );
    })
  );

  it.effect("preserves Solana's broadcast result", () =>
    Effect.gen(function* () {
      const sendTransaction = vi.fn(async () => "solana-hash");
      const connector = {
        id: "solana",
        isSolanaConnector: true,
        sendTransaction,
      } as unknown as Connector;

      expect(
        yield* makeSolanaWalletDriver({ connector }).signTransaction({
          tx: "abcd",
        })
      ).toEqual({
        broadcasted: true,
        signedTx: "solana-hash",
      });
      expect(sendTransaction).toHaveBeenCalledWith("abcd");
    })
  );

  it.effect("preserves Cardano's signed-payload result", () =>
    Effect.gen(function* () {
      const signTransaction = vi.fn(() => Effect.succeed("cardano-signed"));
      const connector = {
        id: "cardano",
        type: "cardanoWallet",
        signTransaction,
      } as unknown as Connector;

      expect(
        yield* makeCardanoWalletDriver({ connector }).signTransaction({
          tx: "abcd",
        })
      ).toEqual({
        broadcasted: false,
        signedTx: "cardano-signed",
      });
    })
  );

  it.effect("preserves TON's broadcast result", () =>
    Effect.gen(function* () {
      const signTransaction = vi.fn(() => Effect.succeed("ton-hash"));
      const connector = {
        id: "ton",
        type: "tonWallet",
        signTransaction,
      } as unknown as Connector;

      expect(
        yield* makeTonWalletDriver({ connector }).signTransaction({ tx: "{}" })
      ).toEqual({ broadcasted: true, signedTx: "ton-hash" });
    })
  );

  it.effect("maps decoding and connector failures to typed driver errors", () =>
    Effect.gen(function* () {
      const rejected = new Error("rejected");
      const tronConnector = {
        id: "tronLink",
        signTransaction: vi.fn(),
      } as unknown as Connector;
      const tonConnector = {
        id: "ton",
        type: "tonWallet",
        signTransaction: () => Effect.fail(rejected),
      } as unknown as Connector;

      const decodeFailure = yield* Effect.flip(
        makeTronWalletDriver({ connector: tronConnector }).signTransaction({
          tx: "{}",
        })
      );
      const broadcastFailure = yield* Effect.flip(
        makeTonWalletDriver({ connector: tonConnector }).signTransaction({
          tx: "{}",
        })
      );

      expect(decodeFailure._tag).toBe("WalletDecodeError");
      expect(broadcastFailure._tag).toBe("WalletBroadcastError");
    })
  );
});
