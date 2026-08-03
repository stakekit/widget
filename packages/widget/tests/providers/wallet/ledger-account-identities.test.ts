import { describe, expect, it } from "vitest";
import {
  findLedgerAccountByAddress,
  getOtherLedgerAccounts,
} from "../../../src/app/composition/providers/rainbow/account-identities";

const first = { address: "cosmAaaa1234", id: "first" };
const second = { address: "cosmBbbb1234", id: "second" };

describe("Ledger account identities", () => {
  it("preserves full colliding addresses as account identities", () => {
    const otherAccounts = getOtherLedgerAccounts({
      accounts: [first, second],
      currentAddress: "current",
      network: "cosmos",
    });

    expect(otherAccounts.map((account) => account.address)).toEqual([
      first.address,
      second.address,
    ]);
    expect(findLedgerAccountByAddress(otherAccounts, second.address)?.id).toBe(
      "second"
    );
  });

  it("filters the current EVM address case-insensitively only on EVM chains", () => {
    const account = { address: "0xAbCd1234", id: "evm" };

    expect(
      getOtherLedgerAccounts({
        accounts: [account],
        currentAddress: "0xabcd1234",
        network: "ethereum",
      })
    ).toEqual([]);
    expect(
      getOtherLedgerAccounts({
        accounts: [account],
        currentAddress: "0xabcd1234",
        network: "cosmos",
      })
    ).toEqual([account]);
  });
});
