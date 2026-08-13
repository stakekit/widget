import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
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
  it("normalizes a Tron signed transaction to a JSON payload", async () => {
    const signTransaction = vi.fn(async () => ({ txID: "signed" }));
    const connector = {
      id: "tronLink",
      signTransaction,
    } as unknown as Connector;

    await expect(
      Effect.runPromise(
        makeTronWalletDriver({ connector }).signTransaction({ tx: tronTx })
      )
    ).resolves.toEqual({
      broadcasted: false,
      signedTx: JSON.stringify({ txID: "signed" }),
    });
    expect(signTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ txID: "tron-id" })
    );
  });

  it("preserves Solana's broadcast result", async () => {
    const sendTransaction = vi.fn(async () => "solana-hash");
    const connector = {
      id: "solana",
      isSolanaConnector: true,
      sendTransaction,
    } as unknown as Connector;

    await expect(
      Effect.runPromise(
        makeSolanaWalletDriver({ connector }).signTransaction({ tx: "abcd" })
      )
    ).resolves.toEqual({
      broadcasted: true,
      signedTx: "solana-hash",
    });
    expect(sendTransaction).toHaveBeenCalledWith("abcd");
  });

  it("preserves Cardano's signed-payload result", async () => {
    const signTransaction = vi.fn(() => Effect.succeed("cardano-signed"));
    const connector = {
      id: "cardano",
      type: "cardanoWallet",
      signTransaction,
    } as unknown as Connector;

    await expect(
      Effect.runPromise(
        makeCardanoWalletDriver({ connector }).signTransaction({ tx: "abcd" })
      )
    ).resolves.toEqual({
      broadcasted: false,
      signedTx: "cardano-signed",
    });
  });

  it("preserves TON's broadcast result", async () => {
    const signTransaction = vi.fn(() => Effect.succeed("ton-hash"));
    const connector = {
      id: "ton",
      type: "tonWallet",
      signTransaction,
    } as unknown as Connector;

    await expect(
      Effect.runPromise(
        makeTonWalletDriver({ connector }).signTransaction({ tx: "{}" })
      )
    ).resolves.toEqual({ broadcasted: true, signedTx: "ton-hash" });
  });

  it("maps decoding and connector failures to typed driver errors", async () => {
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

    const decodeFailure = await Effect.runPromise(
      Effect.flip(
        makeTronWalletDriver({ connector: tronConnector }).signTransaction({
          tx: "{}",
        })
      )
    );
    const broadcastFailure = await Effect.runPromise(
      Effect.flip(
        makeTonWalletDriver({ connector: tonConnector }).signTransaction({
          tx: "{}",
        })
      )
    );

    expect(decodeFailure._tag).toBe("WalletDecodeError");
    expect(broadcastFailure._tag).toBe("WalletBroadcastError");
  });
});
