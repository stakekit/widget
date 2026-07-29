import type { Chain } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { WalletIntegrationError } from "../../../services/wallet/domain/errors";
import { WalletModal } from "../../../services/wallet/wallet-modal";
import { WalletService } from "../../../services/wallet/wallet-service";

type LedgerAccountConnector = {
  readonly requestAndSwitchAccount: (
    chain: Chain
  ) => Effect.Effect<Chain, WalletIntegrationError>;
};

type AddLedgerAccountCommand = {
  readonly chain: Chain;
  readonly connector: LedgerAccountConnector | null;
};

export const runAddLedgerAccount = (command: AddLedgerAccountCommand) => {
  if (!command.connector) {
    return Effect.fail(
      new WalletIntegrationError({
        message: "Only Ledger Live is supported",
        operation: "ledger-add-account",
      })
    );
  }

  return command.connector.requestAndSwitchAccount(command.chain).pipe(
    Effect.tap(() => WalletModal.use((modal) => modal.closeChain)),
    Effect.asVoid
  );
};

export const addLedgerAccountAtom = appRuntime.fn(
  (command: AddLedgerAccountCommand) => runAddLedgerAccount(command)
);

type LogoutCommand = {
  readonly clearDatabases?: () => Promise<void>;
  readonly disconnect: Effect.Effect<void, unknown>;
};

const clearIndexedDatabases = async () => {
  const databases = await indexedDB.databases();
  databases.forEach(
    (database) => database.name && indexedDB.deleteDatabase(database.name)
  );
};

export const runLogout = Effect.fn("runLogout")(function* ({
  clearDatabases = clearIndexedDatabases,
  disconnect,
}: LogoutCommand) {
  yield* disconnect;
  yield* Effect.tryPromise(clearDatabases);
});

export const logoutAtom = walletRuntime.fn(() =>
  WalletService.use((wallet) =>
    runLogout({
      disconnect: wallet.disconnect(),
    }).pipe(Effect.tap(() => WalletModal.use((modal) => modal.closeChain)))
  )
);
