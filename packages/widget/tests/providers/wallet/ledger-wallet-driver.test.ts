import type { Account } from "@ledgerhq/wallet-api-client";
import type { RawTransaction } from "@ledgerhq/wallet-api-core";
import { Effect, Result } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { makeLedgerWalletDriver } from "../../../src/services/wallet/drivers/ledger";

const account = { id: "ledger-account" } as Account;
const transactionInput = {
  ledgerHwAppId: "ethereum",
  network: "ethereum" as const,
  tx: "{}",
  txMeta: {} as Parameters<
    ReturnType<typeof makeLedgerWalletDriver>["signTransaction"]
  >[0]["txMeta"],
};

const makeConnector = () => {
  const prepareTransaction = vi.fn<() => Result.Result<RawTransaction, string>>(
    () => Result.succeed({} as RawTransaction)
  );
  const deserializeTransaction = vi.fn(() => ({ family: "ethereum" }));
  const signAndBroadcast = vi.fn(async () => "0xledger-hash");
  const switchAccount = vi.fn();
  const connector = {
    id: "ledgerLive",
    prepareTransaction,
    deserializeTransaction,
    walletApiClient: { transaction: { signAndBroadcast } },
    switchAccount,
  } as unknown as Connector;

  return {
    connector,
    deserializeTransaction,
    prepareTransaction,
    signAndBroadcast,
    switchAccount,
  };
};

describe("Ledger wallet driver", () => {
  it("prepares, deserializes, selects the account, and broadcasts", async () => {
    const ledger = makeConnector();
    const driver = makeLedgerWalletDriver({
      connector: ledger.connector,
      currentAccountId: account.id,
    });

    await expect(
      Effect.runPromise(driver.signTransaction(transactionInput))
    ).resolves.toEqual({
      broadcasted: true,
      signedTx: "0xledger-hash",
    });
    expect(ledger.prepareTransaction).toHaveBeenCalledWith({
      network: "ethereum",
      tx: "{}",
      txMeta: transactionInput.txMeta,
    });
    expect(ledger.deserializeTransaction).toHaveBeenCalledTimes(1);
    expect(ledger.signAndBroadcast).toHaveBeenCalledWith(
      account.id,
      expect.anything(),
      { hwAppId: "ethereum" }
    );
  });

  it("requires a selected account before preparing", async () => {
    const ledger = makeConnector();
    const failure = await Effect.runPromise(
      Effect.flip(
        makeLedgerWalletDriver({
          connector: ledger.connector,
          currentAccountId: undefined,
        }).signTransaction(transactionInput)
      )
    );

    expect(failure._tag).toBe("WalletCapabilityUnavailableError");
    expect(ledger.prepareTransaction).not.toHaveBeenCalled();
  });

  it("maps preparation and broadcast failures to distinct errors", async () => {
    const ledger = makeConnector();
    ledger.prepareTransaction.mockReturnValue(Result.fail("invalid tx"));
    const decodeFailure = await Effect.runPromise(
      Effect.flip(
        makeLedgerWalletDriver({
          connector: ledger.connector,
          currentAccountId: account.id,
        }).signTransaction(transactionInput)
      )
    );

    ledger.prepareTransaction.mockReturnValue(
      Result.succeed({} as RawTransaction)
    );
    ledger.signAndBroadcast.mockRejectedValue(new Error("rejected"));
    const broadcastFailure = await Effect.runPromise(
      Effect.flip(
        makeLedgerWalletDriver({
          connector: ledger.connector,
          currentAccountId: account.id,
        }).signTransaction(transactionInput)
      )
    );

    expect(decodeFailure._tag).toBe("WalletDecodeError");
    expect(broadcastFailure._tag).toBe("WalletBroadcastError");
  });

  it("switches the Ledger account through the driver", async () => {
    const ledger = makeConnector();
    const driver = makeLedgerWalletDriver({
      connector: ledger.connector,
      currentAccountId: account.id,
    });

    await Effect.runPromise(
      driver.switchAccount({ account, connector: ledger.connector })
    );

    expect(ledger.switchAccount).toHaveBeenCalledWith(account);
  });
});
