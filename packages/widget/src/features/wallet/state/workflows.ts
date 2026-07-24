import type { Chain } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { WalletIntegrationError } from "../../../services/wallet/domain/errors";
import { WalletService } from "../../../services/wallet/wallet-service";
import {
  actionHistoryRevisionAtom,
  resetActionHistoryRevision,
} from "../../classic-transaction-flow/state/action-history";

type LedgerAccountConnector = {
  readonly requestAndSwitchAccount: (
    chain: Chain
  ) => Effect.Effect<Chain, WalletIntegrationError>;
};

export const addLedgerAccountAtom = Atom.fn(
  (command: {
    readonly chain: Chain;
    readonly closeChainModal: () => void;
    readonly connector: LedgerAccountConnector | null;
  }) => {
    if (!command.connector) {
      return Effect.fail(
        new WalletIntegrationError({
          message: "Only Ledger Live is supported",
          operation: "ledger-add-account",
        })
      );
    }

    return command.connector.requestAndSwitchAccount(command.chain).pipe(
      Effect.tap(() => Effect.sync(command.closeChainModal)),
      Effect.asVoid
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

export const logoutAtom = walletRuntime.fn((_, context) =>
  WalletService.use((wallet) =>
    runLogout({
      disconnect: wallet.disconnect(),
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          context.set(actionHistoryRevisionAtom, resetActionHistoryRevision());
        })
      )
    )
  )
);
