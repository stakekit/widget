import { describe, expect, it } from "vitest";
import { getOtherAccounts } from "../../../src/features/wallet/state/account-identities";

const first = { address: "cosmAaaa1234", id: "first" };
const second = { address: "cosmBbbb1234", id: "second" };

describe("Ledger account identities", () => {
  it("preserves full colliding addresses as account identities", () => {
    const otherAccounts = getOtherAccounts({
      accounts: [first, second],
      currentAddress: "current",
      network: "cosmos",
    });

    expect(otherAccounts).toEqual([first, second]);
  });

  it("filters the current EVM address case-insensitively only on EVM chains", () => {
    const account = { address: "0xAbCd1234", id: "evm" };

    expect(
      getOtherAccounts({
        accounts: [account],
        currentAddress: "0xabcd1234",
        network: "ethereum",
      })
    ).toEqual([]);
    expect(
      getOtherAccounts({
        accounts: [account],
        currentAddress: "0xabcd1234",
        network: "cosmos",
      })
    ).toEqual([account]);
  });
});
