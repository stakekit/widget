import { useAtomSet } from "@effect/atom-react";
import { AccountExtraInfoContext } from "@stakekit/rainbowkit";
import type { PropsWithChildren } from "react";
import type { Address } from "viem";
import { formatAddress } from "../../utils";
import { widgetAtomRuntime } from "../effect-atom-runtime/widget-runtime";
import { RainbowKitProviderWithTheme } from "../rainbow-kit";
import { useSKWallet } from "../wallet/react/use-wallet";
import {
  WalletService,
  type WalletSwitchAccountInput,
} from "../wallet/runtime/service";

const switchLedgerAccountAtom = widgetAtomRuntime.fn(
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
