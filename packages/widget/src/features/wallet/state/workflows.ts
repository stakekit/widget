import type { Chain } from "@stakekit/rainbowkit";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { walletCommandIdentity } from "../../../services/wallet/wallet-command-identity";
import { WalletService } from "../../../services/wallet/wallet-service";
import { currentWalletStateAtom } from "./selectors";

type AddLedgerAccountCommand = {
  readonly chain: Chain;
};

export const addLedgerAccountAtom = walletRuntime.fn(
  (command: AddLedgerAccountCommand, context) => {
    const expected = walletCommandIdentity(context(currentWalletStateAtom));
    return WalletService.use((wallet) =>
      wallet.addLedgerAccount({ expected, targetChain: command.chain })
    );
  }
);

export const logoutAtom = walletRuntime.fn(() =>
  WalletService.use((wallet) => wallet.logout)
);
