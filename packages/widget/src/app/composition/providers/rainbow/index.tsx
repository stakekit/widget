import { useAtomSet } from "@effect/atom-react";
import { AccountExtraInfoContext } from "@stakekit/rainbowkit";
import type { PropsWithChildren } from "react";
import type { Address } from "viem";
import { useSKWallet } from "../../../../features/wallet";
import {
  WalletService,
  type WalletSwitchAccountInput,
} from "../../../../services/wallet/wallet-service";
import { formatAddress } from "../../../../shared/lib/general";
import { appRuntime } from "../../../runtime";
import { RainbowKitProviderWithTheme } from "../rainbow-kit";

const switchLedgerAccountAtom = appRuntime.fn(
  (input: WalletSwitchAccountInput) =>
    WalletService.use((wallet) => wallet.switchAccount(input))
);

export const RainbowProvider = ({ children }: PropsWithChildren) => {
  const wallet = useSKWallet();
  const switchAccount = useAtomSet(switchLedgerAccountAtom, {
    mode: "promise",
  });

  const otherAddresses =
    wallet.ledgerAccounts
      ?.filter((account) => account.address !== wallet.address)
      .map((account) => formatAddress(account.address) as Address) ?? [];

  return (
    <AccountExtraInfoContext.Provider
      value={{
        otherAddresses,
        onOtherAddressClick: (selectedAddress: Address) => {
          const account = wallet.ledgerAccounts?.find(
            (candidate) => formatAddress(candidate.address) === selectedAddress
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
