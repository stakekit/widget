import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import type { Connector } from "wagmi";
import { makeStellarWalletDriver } from "../../../src/services/wallet/internal/adapters/stellar/driver";

const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

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
            address,
            family: "classic",
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
          address,
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
            address,
            family: "classic",
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
            address,
            family: "classic",
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
