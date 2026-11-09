import type { BaseSigner, EIP712TypedData } from "@zama-fhe/sdk";
import { Effect, FiberSet, Schema } from "effect";
import { type Address, type Hex, isHex } from "viem";

import {
  type ConfidentialChainId,
  getConfidentialNetwork,
} from "../../../domain/earn/confidential";
import type { WalletAddress } from "../../../domain/identity/identifiers";
import type { Eip712TypedData } from "../../wallet/wallet-commands";
import { WalletService } from "../../wallet/wallet-service";
import { ZamaError } from "./zama-error";

const PermitTypedData = Schema.Struct({
  domain: Schema.Struct({
    chainId: Schema.optionalKey(Schema.Union([Schema.Finite, Schema.BigInt])),
    name: Schema.optionalKey(Schema.String),
    verifyingContract: Schema.optionalKey(
      Schema.TemplateLiteral(["0x", Schema.String])
    ),
    version: Schema.optionalKey(Schema.String),
  }),
  message: Schema.Record(Schema.String, Schema.Unknown),
  primaryType: Schema.String,
  types: Schema.Record(
    Schema.String,
    Schema.Array(Schema.Struct({ name: Schema.String, type: Schema.String }))
  ),
});

/**
 * Makes the SDK signer that asks the connected wallet for permit signatures.
 * It never sends transactions: those go through the widget transaction flow.
 */
export const makePermitSigner = Effect.gen(function* () {
  const wallet = yield* WalletService;
  const runPromise = yield* FiberSet.makeRuntimePromise();

  const signPermit = (
    typedData: EIP712TypedData,
    owner: WalletAddress,
    chainId: ConfidentialChainId
  ) =>
    Effect.gen(function* () {
      const network = getConfidentialNetwork(chainId);
      if (!network) {
        return yield* new ZamaError({
          cause: `No confidential network for chain ${chainId}`,
          operation: "permit",
        });
      }
      // The SDK builds the domain chainId as a bigint; wallets take a number.
      const {
        domain: { chainId: domainChainId, ...domain },
        ...permit
      } = yield* Schema.decodeUnknownEffect(PermitTypedData)(typedData);
      const contracts = permit.message.contractAddresses;
      const signature = yield* wallet.signPermit({
        expectedOwner: { address: owner, network },
        meta: {
          address: owner,
          chainId,
          contracts: Array.isArray(contracts)
            ? contracts.filter((value) => typeof value === "string")
            : [],
        },
        typedData: {
          ...permit,
          domain: {
            ...domain,
            ...(domainChainId === undefined
              ? {}
              : { chainId: Number(domainChainId) }),
          },
        } satisfies Eip712TypedData,
      });
      // viem's signer seam takes hex; an EVM wallet signs in hex.
      if (!isHex(signature)) {
        return yield* new ZamaError({
          cause: "The wallet returned a non-hex permit signature",
          operation: "permit",
        });
      }
      return signature;
    });

  return (
    Base: typeof BaseSigner,
    owner: WalletAddress,
    address: Address,
    chainId: ConfidentialChainId
  ): BaseSigner =>
    new (class WidgetPermitSigner extends Base {
      signTypedData(typedData: EIP712TypedData) {
        return runPromise(signPermit(typedData, owner, chainId));
      }
      writeContract(): Promise<Hex> {
        return Promise.reject(
          new Error("Zama transactions go through the widget transaction flow")
        );
      }
    })({ address, chainId });
});
