import {
  isEvmWalletNetwork,
  type WalletNetwork,
} from "../../../domain/wallet/network";

type AccountIdentity = { readonly address: string };

export const getOtherAccounts = <Account extends AccountIdentity>({
  accounts,
  currentAddress,
  network,
}: {
  readonly accounts: ReadonlyArray<Account>;
  readonly currentAddress: string;
  readonly network: WalletNetwork;
}): ReadonlyArray<Account> =>
  accounts.filter((account) => {
    if (isEvmWalletNetwork(network)) {
      return account.address.toLowerCase() !== currentAddress.toLowerCase();
    }
    return account.address !== currentAddress;
  });
