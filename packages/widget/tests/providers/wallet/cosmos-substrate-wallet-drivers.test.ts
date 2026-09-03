import type { ChainWalletBase } from "@cosmos-kit/core";
import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import type { Connector } from "wagmi";
import { makeCosmosWalletDriver } from "../../../src/services/wallet/internal/adapters/cosmos/driver";
import { makeSubstrateWalletDriver } from "../../../src/services/wallet/internal/adapters/substrate/driver";

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

describe("Cosmos and Substrate wallet drivers", () => {
  it.effect("signs Cosmos transactions as non-broadcast payloads", () =>
    Effect.gen(function* () {
      const signTransaction = vi.fn(() => Effect.succeed("cosmos-signed"));
      const connector = {
        id: "cosmos",
        type: "cosmosProvider",
        signTransaction,
      } as unknown as Connector;
      const chainWallet = { chainId: "cosmoshub-4" } as ChainWalletBase;

      expect(
        yield* makeCosmosWalletDriver({
          chainWallet,
          connector,
        }).signTransaction({
          tx: "abcd",
        })
      ).toEqual({ broadcasted: false, signedTx: "cosmos-signed" });
      expect(signTransaction).toHaveBeenCalledWith({
        cw: chainWallet,
        tx: "abcd",
      });
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
