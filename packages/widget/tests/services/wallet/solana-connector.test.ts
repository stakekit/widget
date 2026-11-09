import { describe, expect, it } from "vitest";

import { deserializeSolanaTransaction } from "../../../src/services/wallet/internal/adapters/solana/solana-connector";
import { decodeSolanaTransactionToBuffer } from "../../../src/services/wallet/internal/adapters/solana/transaction";

describe("solana connector", () => {
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

  it("throws when a payload is neither a versioned nor a legacy transaction", () => {
    expect(() => deserializeSolanaTransaction("not-a-valid-tx")).toThrow(
      "Failed to deserialize Solana transaction"
    );
  });
});
