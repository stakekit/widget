import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { makeStellarWalletDriver } from "../../../src/services/wallet/internal/adapters/stellar/driver";

const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("Stellar wallet driver", () => {
  it("signs a mainnet XDR without requiring a reported signer address", async () => {
    const signTransaction = vi.fn(() =>
      Effect.succeed({ signedTxXdr: "signed-xdr" })
    );
    const connector = {
      id: "stellar-wallet-connect",
      signTransaction,
      type: "stellar-wallet",
    } as unknown as Connector;

    await expect(
      Effect.runPromise(
        makeStellarWalletDriver({ connector }).signTransaction({
          address,
          family: "classic",
          ledgerHwAppId: null,
          network: "stellar",
          tx: "unsigned-xdr",
          txMeta: {} as never,
        })
      )
    ).resolves.toEqual({
      broadcasted: false,
      signedTx: "signed-xdr",
    });
    expect(signTransaction).toHaveBeenCalledWith({
      address,
      networkPassphrase: "Public Global Stellar Network ; September 2015",
      transactionXdr: "unsigned-xdr",
    });
  });

  it("rejects backend Stellar testnet values", async () => {
    const signTransaction = vi.fn(() =>
      Effect.succeed({ signedTxXdr: "signed-xdr" })
    );
    const connector = {
      id: "freighter",
      signTransaction,
      type: "stellar-wallet",
    } as unknown as Connector;

    await expect(
      Effect.runPromise(
        Effect.flip(
          makeStellarWalletDriver({ connector }).signTransaction({
            address,
            family: "classic",
            ledgerHwAppId: null,
            network: "stellar-testnet",
            tx: "unsigned-xdr",
            txMeta: {} as never,
          })
        )
      )
    ).resolves.toMatchObject({
      _tag: "WalletCapabilityUnavailableError",
      capability: "transaction",
    });
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("rejects an empty signed XDR", async () => {
    const connector = {
      id: "lobstr",
      signTransaction: () => Effect.succeed({ signedTxXdr: "  " }),
      type: "stellar-wallet",
    } as unknown as Connector;

    await expect(
      Effect.runPromise(
        Effect.flip(
          makeStellarWalletDriver({ connector }).signTransaction({
            address,
            family: "classic",
            ledgerHwAppId: null,
            network: "stellar",
            tx: "unsigned-xdr",
            txMeta: {} as never,
          })
        )
      )
    ).resolves.toMatchObject({
      _tag: "WalletSigningError",
      cause: {
        operation: "stellar-sign-transaction",
      },
    });
  });
});
