import type { Chain } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { walletCommandIdentity } from "../../../services/wallet/domain/scope";
import { WalletAccountSetupService } from "../../../services/wallet/wallet-account-setup-service";
import { WalletModal } from "../../../services/wallet/wallet-modal";
import { WalletService } from "../../../services/wallet/wallet-service";
import { currentWalletStateAtom } from "./selectors";

type AddLedgerAccountCommand = {
  readonly chain: Chain;
};

export const addLedgerAccountAtom = walletRuntime.fn(
  (command: AddLedgerAccountCommand, context) => {
    const expected = walletCommandIdentity(context(currentWalletStateAtom));
    return WalletAccountSetupService.use((service) =>
      service.addLedgerAccount({ expected, targetChain: command.chain })
    );
  }
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
