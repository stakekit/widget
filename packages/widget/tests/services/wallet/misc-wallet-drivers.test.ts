import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import type { Connector } from "wagmi";

import { makeCosmosWalletDriver } from "../../../src/services/wallet/internal/adapters/cosmos/driver";
import { makeStellarWalletDriver } from "../../../src/services/wallet/internal/adapters/stellar/driver";
import { makeSubstrateWalletDriver } from "../../../src/services/wallet/internal/adapters/substrate/driver";
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

const substrateTx = JSON.stringify({
  metadataRpc: "0x00",
  specName: "polkadot",
  specVersion: 1,
  tx: {
    address: "address",
    blockHash: "0x00",
    blockNumber: "0x01",
    era: "0x00",
    genesisHash: "0x00",
    metadataRpc: "0x00",
    method: "0x00",
    nonce: "0x00",
    signedExtensions: ["CheckNonce"],
    specVersion: "0x01",
    tip: "0x00",
    transactionVersion: "0x01",
    version: 4,
  },
});

const stellarAddress =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

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

  it.effect("requires the Cosmos chain wallet capability", () =>
    Effect.gen(function* () {
      const connector = {
        id: "cosmos",
        type: "cosmosProvider",
        signTransaction: vi.fn(),
      } as unknown as Connector;
      const failure = yield* Effect.flip(
        makeCosmosWalletDriver({
          chainWallet: null,
          connector,
        }).signTransaction({ tx: "abcd" })
      );

      expect(failure._tag).toBe("WalletCapabilityUnavailableError");
    })
  );

  it.effect(
    "decodes and signs Substrate transactions without broadcasting",
    () =>
      Effect.gen(function* () {
        const signTransaction = vi.fn(() => Effect.succeed("substrate-signed"));
        const connector = {
          id: "substrate",
          type: "substrateProvider",
          signTransaction,
        } as unknown as Connector;

        expect(
          yield* makeSubstrateWalletDriver({ connector }).signTransaction({
            tx: substrateTx,
          })
        ).toEqual({
          broadcasted: false,
          signedTx: "substrate-signed",
        });
        expect(signTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            rawTx: substrateTx,
            tx: expect.objectContaining({ signedExtensions: ["CheckNonce"] }),
          })
        );
      })
  );

  it.effect("keeps Substrate decoding and signing failures distinct", () =>
    Effect.gen(function* () {
      const cause = new Error("rejected");
      const connector = {
        id: "substrate",
        type: "substrateProvider",
        signTransaction: () => Effect.fail(cause),
      } as unknown as Connector;
      const driver = makeSubstrateWalletDriver({ connector });

      const decodeFailure = yield* Effect.flip(
        driver.signTransaction({ tx: "{}" })
      );
      const signingFailure = yield* Effect.flip(
        driver.signTransaction({ tx: substrateTx })
      );

      expect(decodeFailure._tag).toBe("WalletDecodeError");
      expect(signingFailure._tag).toBe("WalletSigningError");
    })
  );
});

describe("Stellar wallet driver", () => {
  it.effect(
    "signs a mainnet XDR without requiring a reported signer address",
    () =>
      Effect.gen(function* () {
        const signTransaction = vi.fn(() =>
          Effect.succeed({ signedTxXdr: "signed-xdr" })
        );
        const connector = {
          id: "stellar-wallet-connect",
          signTransaction,
          type: "stellar-wallet",
        } as unknown as Connector;

        expect(
          yield* makeStellarWalletDriver({ connector }).signTransaction({
            address: stellarAddress,
            family: "yield",
            ledgerHwAppId: null,
            network: "stellar",
            tx: "unsigned-xdr",
            txMeta: {} as never,
          })
        ).toEqual({
          broadcasted: false,
          signedTx: "signed-xdr",
        });
        expect(signTransaction).toHaveBeenCalledWith({
          address: stellarAddress,
          networkPassphrase: "Public Global Stellar Network ; September 2015",
          transactionXdr: "unsigned-xdr",
        });
      })
  );

  it.effect("rejects backend Stellar testnet values", () =>
    Effect.gen(function* () {
      const signTransaction = vi.fn(() =>
        Effect.succeed({ signedTxXdr: "signed-xdr" })
      );
      const connector = {
        id: "freighter",
        signTransaction,
        type: "stellar-wallet",
      } as unknown as Connector;

      expect(
        yield* Effect.flip(
          makeStellarWalletDriver({ connector }).signTransaction({
            address: stellarAddress,
            family: "yield",
            ledgerHwAppId: null,
            network: "stellar-testnet",
            tx: "unsigned-xdr",
            txMeta: {} as never,
          })
        )
      ).toMatchObject({
        _tag: "WalletCapabilityUnavailableError",
        capability: "transaction",
      });
      expect(signTransaction).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects an empty signed XDR", () =>
    Effect.gen(function* () {
      const connector = {
        id: "lobstr",
        signTransaction: () => Effect.succeed({ signedTxXdr: "  " }),
        type: "stellar-wallet",
      } as unknown as Connector;

      expect(
        yield* Effect.flip(
          makeStellarWalletDriver({ connector }).signTransaction({
            address: stellarAddress,
            family: "yield",
            ledgerHwAppId: null,
            network: "stellar",
            tx: "unsigned-xdr",
            txMeta: {} as never,
          })
        )
      ).toMatchObject({
        _tag: "WalletSigningError",
        cause: {
          operation: "stellar-sign-transaction",
        },
      });
    })
  );
});
