import { Schema } from "effect";

export const unsignedSolanaTransactionCodec = Schema.String;
export type DecodedSolanaTransaction =
  typeof unsignedSolanaTransactionCodec.Type;

type SolanaTransactionEncoding = "base64" | "hex";
type SolanaTransactionBytes = {
  encoding: SolanaTransactionEncoding;
  buffer: Buffer;
};

const solanaHexStringRegex = /^[0-9a-fA-F]+$/u;
const stripSolanaHexPrefix = (tx: string) =>
  tx.startsWith("0x") ? tx.slice(2) : tx;
const isSolanaHexTransaction = (tx: DecodedSolanaTransaction): boolean => {
  const withoutHexPrefix = stripSolanaHexPrefix(tx.trim());
  return (
    withoutHexPrefix.length > 0 &&
    withoutHexPrefix.length % 2 === 0 &&
    solanaHexStringRegex.test(withoutHexPrefix)
  );
};

export const decodeSolanaTransactionToBuffer = (
  tx: DecodedSolanaTransaction
): SolanaTransactionBytes => {
  const normalizedTx = tx.trim();
  const withoutHexPrefix = stripSolanaHexPrefix(normalizedTx);
  if (isSolanaHexTransaction(normalizedTx)) {
    return { encoding: "hex", buffer: Buffer.from(withoutHexPrefix, "hex") };
  }
  return { encoding: "base64", buffer: Buffer.from(normalizedTx, "base64") };
};

export const normalizeSolanaTransactionToHex = (
  tx: DecodedSolanaTransaction
): DecodedSolanaTransaction =>
  decodeSolanaTransactionToBuffer(tx).buffer.toString("hex");
