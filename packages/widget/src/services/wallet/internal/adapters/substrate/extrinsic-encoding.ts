import { TypeRegistry } from "@polkadot/types";
import type { SignerPayloadJSON } from "@polkadot/types/types";
import { u8aToHex } from "@polkadot/util";

export const encodeSignedExtrinsic = ({
  metadataRpc,
  signature,
  tx,
}: {
  readonly metadataRpc: string;
  readonly signature: `0x${string}`;
  readonly tx: SignerPayloadJSON;
}): string => {
  const registry = new TypeRegistry();

  registry.setMetadata(registry.createType("Metadata", metadataRpc));

  const extrinsic = registry.createType(
    "Extrinsic",
    { method: tx.method },
    { version: tx.version }
  );

  extrinsic.addSignature(tx.address, signature, tx);

  return u8aToHex(extrinsic.toU8a());
};
