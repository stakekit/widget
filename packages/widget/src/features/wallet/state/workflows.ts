import { walletRuntime } from "../../../runtime/wallet-runtime";
import { walletCommandIdentity } from "../../../services/wallet/wallet-command-identity";
import type { WalletSwitchAccountInput } from "../../../services/wallet/wallet-commands";
import type { Chain } from "../../../services/wallet/wallet-descriptors";
import { WalletService } from "../../../services/wallet/wallet-service";
import { walletConnectionStateAtom } from "./selectors";

type AddLedgerAccountCommand = {
  readonly chain: Chain;
};

export const addLedgerAccountAtom = walletRuntime.fn(
  (command: AddLedgerAccountCommand, context) => {
    const expected = walletCommandIdentity(context(walletConnectionStateAtom));
    return WalletService.use((wallet) =>
      wallet.addLedgerAccount({ expected, targetChain: command.chain })
    );
  },
  // WalletService serializes Ledger requests; a repeated click waits for the
  // first and is rejected as stale once that request switched the account.
  { concurrent: true }
);

export const logoutAtom = walletRuntime.fn(() =>
  WalletService.use((wallet) => wallet.logout)
);

export const switchAccountAtom = walletRuntime.fn(
  (input: WalletSwitchAccountInput) =>
    WalletService.use((wallet) => wallet.switchAccount(input))
);
