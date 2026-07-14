import type { Chain } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetAtomRuntime } from "../providers/effect-atom-runtime/widget-runtime";
import { WalletService } from "../providers/wallet/runtime/service";

type LedgerAccountConnector = {
  readonly requestAndSwitchAccount: (
    chain: Chain
  ) => Effect.Effect<Chain, Error>;
};

export const addLedgerAccountAtom = Atom.fn(
  (command: {
    readonly chain: Chain;
    readonly closeChainModal: () => void;
    readonly connector: LedgerAccountConnector | null;
  }) => {
    if (!command.connector) {
      return Effect.fail(new Error("Only Ledger Live is supported"));
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

export const logoutAtom = widgetAtomRuntime.fn(() =>
  WalletService.use((wallet) =>
    runLogout({
      disconnect: wallet.disconnect(),
    })
  )
);
