import { AccountExtraInfoContext } from "@stakekit/rainbowkit";
import { List, Maybe } from "purify-ts";
import type { PropsWithChildren } from "react";
import type { Address } from "viem";
import { formatAddress } from "../../utils";
import { RainbowKitProviderWithTheme } from "../rainbow-kit";
import { useSKWallet } from "../sk-wallet";

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
