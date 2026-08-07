import {
  isEvmChain,
  type SupportedSKChains,
} from "../../../../domain/types/chains";

type LedgerAccountIdentity = {
  readonly address: string;
};

const isSameAccountAddress = ({
  currentAddress,
  candidateAddress,
  network,
}: {
  readonly candidateAddress: string;
  readonly currentAddress: string;
  readonly network: SupportedSKChains;
}) =>
  isEvmChain(network)
    ? candidateAddress.toLowerCase() === currentAddress.toLowerCase()
    : candidateAddress === currentAddress;

export const getOtherLedgerAccounts = <Account extends LedgerAccountIdentity>({
  accounts,
  currentAddress,
  network,
}: {
  readonly accounts: ReadonlyArray<Account>;
  readonly currentAddress: string;
  readonly network: SupportedSKChains;
}): ReadonlyArray<Account> =>
  accounts.filter(
    (account) =>
      !isSameAccountAddress({
        candidateAddress: account.address,
        currentAddress,
        network,
      })
  );

export const findLedgerAccountByAddress = <
  Account extends LedgerAccountIdentity,
>(
  accounts: ReadonlyArray<Account>,
  selectedAddress: string
): Account | null =>
  accounts.find((account) => account.address === selectedAddress) ?? null;
