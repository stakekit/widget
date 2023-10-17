import { AccountExtraInfoContext } from "@stakekit/rainbowkit";
import { Address } from "viem";
import { useWagmiConfig } from "../wagmi";
import { RainbowKitProviderWithTheme } from "../rainbow-kit";
import { PropsWithChildren } from "react";
import { List, Maybe } from "purify-ts";
import { formatAddress } from "../../utils";
import { useSKWallet } from "../sk-wallet";

export const RainbowProvider = ({ children }: PropsWithChildren) => {
  const wagmiConfig = useWagmiConfig();

  const { ledgerAccounts, address, onLedgerAccountChange } = useSKWallet();

  const otherAddresses = Maybe.fromNullable(ledgerAccounts)
    .map((v) =>
      v
        .filter((a) => a.address !== address)
        .map((a) => formatAddress(a.address) as Address)
    )
    .orDefault([]);

  return (
    <AccountExtraInfoContext.Provider
      value={{
        otherAddresses,
        onOtherAddressClick: (address: Address) => {
          Maybe.fromNullable(ledgerAccounts).ifJust((accounts) =>
            List.find(
              (acc) => formatAddress(acc.address) === address,
              accounts
            ).ifJust((acc) => onLedgerAccountChange?.(acc))
          );
        },
      }}
    >
      <RainbowKitProviderWithTheme chains={wagmiConfig.data?.chains ?? []}>
        {children}
      </RainbowKitProviderWithTheme>
    </AccountExtraInfoContext.Provider>
  );
};
