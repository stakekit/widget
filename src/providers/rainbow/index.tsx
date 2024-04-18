import type { Address } from "viem";
import { RainbowKitProviderWithTheme } from "../rainbow-kit";
import type { PropsWithChildren } from "react";
import { List, Maybe } from "purify-ts";
import { formatAddress } from "../../utils";
import { useSKWallet } from "../sk-wallet";
import { AccountExtraInfoContext } from "@stakekit/rainbowkit";

export const RainbowProvider = ({ children }: PropsWithChildren) => {
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
      <RainbowKitProviderWithTheme>{children}</RainbowKitProviderWithTheme>
    </AccountExtraInfoContext.Provider>
  );
};
