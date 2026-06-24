import type { Wallet } from "@solana/wallet-adapter-react";
import {
  type Connection,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeSolanaTransactionToBuffer } from "../../src/domain/types/transaction";
import {
  deserializeSolanaTransaction,
  getSolanaConnectors,
} from "../../src/providers/misc/solana-connector";

const createConnectorForTest = ({
  sendTransaction = vi.fn(async () => "signed-hash"),
  connection = {} as Connection,
}: {
  sendTransaction?: ReturnType<typeof vi.fn>;
  connection?: Connection;
}) => {
  const wallet = {
    adapter: {
      name: "Mock Solana",
      icon: "",
      connected: false,
      publicKey: null,
      readyState: "Installed",
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendTransaction,
    },
  } as unknown as Wallet;

  const walletFactory = getSolanaConnectors({
    wallets: [wallet],
    forceWalletConnectOnly: false,
    connection,
    variant: "default",
  }).wallets[0];

  const connectorFactory = walletFactory({} as never).createConnector(
    {} as never
  );
  return connectorFactory({
    emitter: { emit: vi.fn() },
    storage: undefined,
  } as never) as unknown as {
    sendTransaction: (tx: string) => Promise<string>;
  };
};

describe("solana connector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("decodes padded base64 payloads before deserializing", () => {
    const bytes = Buffer.from([1, 2, 3, 4]);
    const decodedTx = decodeSolanaTransactionToBuffer(bytes.toString("base64"));

    expect(decodedTx.encoding).toBe("base64");
    expect(decodedTx.buffer.equals(bytes)).toBe(true);
  });

  it("decodes unpadded base64 payloads before deserializing", () => {
    const bytes = Buffer.from([1, 2, 3, 4]);
    const unpaddedBase64 = bytes.toString("base64").replace(/=+$/u, "");

    const decodedTx = decodeSolanaTransactionToBuffer(unpaddedBase64);

    expect(decodedTx.encoding).toBe("base64");
    expect(decodedTx.buffer.equals(bytes)).toBe(true);
  });

  it("supports hex payloads with 0x prefix", () => {
    const decodedTx = decodeSolanaTransactionToBuffer("0x01020304");

    expect(decodedTx.encoding).toBe("hex");
    expect(decodedTx.buffer.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
  });

  it("returns helpful error for invalid payloads", () => {
    const versionedSpy = vi
      .spyOn(VersionedTransaction, "deserialize")
      .mockImplementation(() => {
        throw new Error("versioned fail");
      });

    const legacySpy = vi.spyOn(Transaction, "from").mockImplementation(() => {
      throw new Error("legacy fail");
    });

    try {
      deserializeSolanaTransaction("not-a-valid-tx");
      throw new Error("expected deserializeSolanaTransaction to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain("Failed to deserialize Solana transaction");
      expect(message).toContain("encoding=base64");
      expect(message).toContain("VersionedTransaction error: versioned fail");
      expect(message).toContain("Legacy Transaction error: legacy fail");
    }

    expect(versionedSpy).toHaveBeenCalledTimes(1);
    expect(legacySpy).toHaveBeenCalledTimes(1);
  });

  it("passes deserialized transaction to wallet adapter", async () => {
    const deserializedTx = { mocked: true } as unknown as VersionedTransaction;
    vi.spyOn(VersionedTransaction, "deserialize").mockReturnValue(
      deserializedTx
    );

    const adapterSendTransaction = vi.fn(async () => "signature");
    const connection = {} as Connection;
    const connector = createConnectorForTest({
      sendTransaction: adapterSendTransaction,
      connection,
    });

    await expect(connector.sendTransaction("AQIDBA==")).resolves.toBe(
      "signature"
    );
    expect(adapterSendTransaction).toHaveBeenCalledWith(
      deserializedTx,
      connection
    );
  });
});
