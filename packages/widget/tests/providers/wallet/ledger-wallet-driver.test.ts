import { describe, expect, it, vi } from "@effect/vitest";
import type { Account } from "@ledgerhq/wallet-api-client";
import type { RawTransaction } from "@ledgerhq/wallet-api-core";
import { Effect } from "effect";
import type { Connector } from "wagmi";
import { makeLedgerWalletDriver } from "../../../src/services/wallet/internal/adapters/ledger/driver";

const account = { id: "ledger-account" } as Account;
type LedgerTransactionInput = Parameters<
  ReturnType<typeof makeLedgerWalletDriver>["signTransaction"]
>[0];
const transactionInput = {
  family: "classic" as const,
  ledgerHwAppId: "ethereum",
  network: "ethereum" as const,
  tx: "{}",
  txMeta: {} as Extract<
    LedgerTransactionInput,
    { readonly family: "classic" }
  >["txMeta"],
};

const makeConnector = () => {
  const prepareTransaction = vi.fn<() => Effect.Effect<RawTransaction, string>>(
    () => Effect.succeed({} as RawTransaction)
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
  it.effect("prepares, deserializes, selects the account, and broadcasts", () =>
    Effect.gen(function* () {
      const ledger = makeConnector();
      const driver = makeLedgerWalletDriver({
        connector: ledger.connector,
        currentAccountId: account.id,
      });

      expect(yield* driver.signTransaction(transactionInput)).toEqual({
        broadcasted: true,
        signedTx: "0xledger-hash",
      });
      expect(ledger.prepareTransaction).toHaveBeenCalledWith({
        family: "classic",
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
    })
  );

  it.effect("requires a selected account before preparing", () =>
    Effect.gen(function* () {
      const ledger = makeConnector();
      const failure = yield* Effect.flip(
        makeLedgerWalletDriver({
          connector: ledger.connector,
          currentAccountId: undefined,
        }).signTransaction(transactionInput)
      );

      expect(failure._tag).toBe("WalletCapabilityUnavailableError");
      expect(ledger.prepareTransaction).not.toHaveBeenCalled();
    })
  );

  it.effect("maps preparation and broadcast failures to distinct errors", () =>
    Effect.gen(function* () {
      const ledger = makeConnector();
      ledger.prepareTransaction.mockReturnValue(Effect.fail("invalid tx"));
      const decodeFailure = yield* Effect.flip(
        makeLedgerWalletDriver({
          connector: ledger.connector,
          currentAccountId: account.id,
        }).signTransaction(transactionInput)
      );

      ledger.prepareTransaction.mockReturnValue(
        Effect.succeed({} as RawTransaction)
      );
      ledger.signAndBroadcast.mockRejectedValue(new Error("rejected"));
      const broadcastFailure = yield* Effect.flip(
        makeLedgerWalletDriver({
          connector: ledger.connector,
          currentAccountId: account.id,
        }).signTransaction(transactionInput)
      );

      expect(decodeFailure._tag).toBe("WalletDecodeError");
      expect(broadcastFailure._tag).toBe("WalletBroadcastError");
    })
  );

  it.effect("switches the Ledger account through the driver", () =>
    Effect.gen(function* () {
      const ledger = makeConnector();
      const driver = makeLedgerWalletDriver({
        connector: ledger.connector,
        currentAccountId: account.id,
      });

      yield* driver.switchAccount({ account, connector: ledger.connector });

      expect(ledger.switchAccount).toHaveBeenCalledWith(account);
    })
  );
});
