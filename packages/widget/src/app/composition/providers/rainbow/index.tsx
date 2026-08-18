import { useAtomSet } from "@effect/atom-react";
import { AccountExtraInfoContext } from "@stakekit/rainbowkit";
import type { PropsWithChildren } from "react";
import type { Address } from "viem";
import { useSKWallet } from "../../../../features/wallet/index";
import type { WalletSwitchAccountInput } from "../../../../services/wallet/wallet-commands";
import { WalletService } from "../../../../services/wallet/wallet-service";
import { walletRuntime } from "../../../runtime/wallet-runtime";
import { RainbowKitProviderWithTheme } from "../rainbow-kit";
import {
  findLedgerAccountByAddress,
  getOtherLedgerAccounts,
} from "./account-identities";

const switchLedgerAccountAtom = walletRuntime.fn(
  (input: WalletSwitchAccountInput) =>
    WalletService.use((wallet) => wallet.switchAccount(input))
);

export const RainbowProvider = ({ children }: PropsWithChildren) => {
  const wallet = useSKWallet();
  const switchAccount = useAtomSet(switchLedgerAccountAtom, {
    mode: "promise",
  });

  const otherAccounts =
    wallet.isConnected && wallet.ledgerAccounts
      ? getOtherLedgerAccounts({
          accounts: wallet.ledgerAccounts,
          currentAddress: wallet.address,
          network: wallet.network,
        })
      : [];
  const otherAddresses = otherAccounts.map(
    (account) => account.address as Address
  );

  return (
    <AccountExtraInfoContext.Provider
      value={{
        otherAddresses,
        onOtherAddressClick: (selectedAddress: Address) => {
          const account = findLedgerAccountByAddress(
            otherAccounts,
            selectedAddress
          );

          if (account && wallet.isConnected) {
            void switchAccount({
              account,
              connector: wallet.connector,
            }).catch(() => undefined);
          }
        },
      }}
    >
      <RainbowKitProviderWithTheme>{children}</RainbowKitProviderWithTheme>
    </AccountExtraInfoContext.Provider>
  );
};
