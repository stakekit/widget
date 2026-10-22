import { describe, expect, it } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { Schema } from "effect";
import {
  type ConfidentialEncryption,
  ConfidentialHandle,
  fillConfidentialBalance,
  getCancelReturnToken,
  getConfidentialCampaignUrl,
  getConfidentialConversion,
  getConfidentialHandleContract,
  getPendingActionDecryptHandle,
  isConfidentialInstantExit,
  isConfidentialYield,
  isUserRevealableBalance,
  planConfidentialEncryption,
  toConfidentialArguments,
} from "../../src/domain/earn/confidential";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiYieldFixture,
} from "../fixtures";

const { cShare, cUsdc, depositBatcher, redeemBatcher, router, usdc } =
  confidentialFixture;
const confidentialYield = confidentialYieldFixture;

const encryption: ConfidentialEncryption = {
  amount: { handle: "0xamount", proof: "0xamountproof" },
  legs: { handles: ["0xleg0", "0xleg1"], proof: "0xlegproof" },
};

describe("confidential vault rules", () => {
  it("recognises a yield by its router legs and leaves plain yields alone", () => {
    expect(isConfidentialYield(confidentialYield())).toBe(true);
    expect(isConfidentialYield(yieldApiYieldFixture())).toBe(false);
  });

  it("publicly decrypts only an unwrap's WITHDRAW, never a batch cancel", () => {
    const hidden = (type: string) => ({
      isEncrypted: true,
      shareAmountRaw: "0xhandle",
      type,
    });

    expect(
      getPendingActionDecryptHandle(hidden("withdrawable"), "WITHDRAW")
    ).toBe("0xhandle");
    expect(
      getPendingActionDecryptHandle(hidden("entering"), "CANCEL_PENDING")
    ).toBeNull();
    expect(
      getPendingActionDecryptHandle(hidden("exiting"), "CANCEL_PENDING")
    ).toBeNull();
    expect(
      getPendingActionDecryptHandle(
        { shareAmountRaw: "5", type: "withdrawable" },
        "WITHDRAW"
      )
    ).toBeNull();
  });

  it("returns the confidential asset when a pending deposit is cancelled", () => {
    expect(
      getCancelReturnToken(confidentialYield(), "CANCEL_PENDING", "entering")
        ?.symbol
    ).toBe(cUsdc.symbol);
    expect(
      getCancelReturnToken(confidentialYield(), "CANCEL_PENDING", "exiting")
    ).toBeNull();
    expect(
      getCancelReturnToken(yieldApiYieldFixture(), "CANCEL_PENDING", "entering")
    ).toBeNull();
  });

  it("needs the API to list the router among the enter execution contracts", () => {
    expect(
      isConfidentialYield(
        confidentialYield({
          executionContracts: {
            enter: [cUsdc.address, depositBatcher],
            exit: [router],
          },
        })
      )
    ).toBe(false);
  });

  it("encrypts the enter amount for the asset token and one leg per batcher", () => {
    const plan = planConfidentialEncryption({
      intent: "enter",
      value: 5_000_000n,
      yieldDto: confidentialYield(),
    });

    expect(plan).toEqual({
      amount: { contract: cUsdc.address, value: 5_000_000n },
      chainId: 11155111,
      legs: { contract: router, values: [0n, 5_000_000n] },
    });
  });

  it("encrypts only router legs on exit, with the amount on this vault's redeem leg", () => {
    const plan = planConfidentialEncryption({
      intent: "exit",
      value: 7n,
      yieldDto: confidentialYield(),
    });

    expect(plan?.amount).toBeNull();
    expect(plan?.legs).toEqual({ contract: router, values: [0n, 7n] });
  });

  it("encrypts only the share amount for the share wrapper on an instant exit", () => {
    const plan = planConfidentialEncryption({
      instant: true,
      intent: "exit",
      value: 7n,
      yieldDto: confidentialYield(),
    });

    expect(plan).toEqual({
      amount: { contract: cShare.address, value: 7n },
      chainId: 11155111,
      legs: null,
    });
  });

  it("exits instantly only when the plain underlying token is the output", () => {
    expect(isConfidentialInstantExit(confidentialYield(), usdc.address)).toBe(
      true
    );
    expect(isConfidentialInstantExit(confidentialYield(), cUsdc.address)).toBe(
      false
    );
    expect(isConfidentialInstantExit(confidentialYield(), undefined)).toBe(
      false
    );
  });

  it("leaves withdrawable unwraps out of user reveal", () => {
    expect(isUserRevealableBalance({ isEncrypted: true, type: "active" })).toBe(
      true
    );
    expect(
      isUserRevealableBalance({ isEncrypted: true, type: "withdrawable" })
    ).toBe(false);
    expect(isUserRevealableBalance({ type: "active" })).toBe(false);
  });

  it("has no plan when this vault's batcher is missing from the leg options", () => {
    const yieldDto = confidentialYield({
      executionContracts: { enter: [cUsdc.address], exit: [router] },
    });

    expect(
      planConfidentialEncryption({ intent: "enter", value: 1n, yieldDto })
    ).toBeNull();
  });

  it("replaces plain amounts with encrypted inputs and the asset token", () => {
    const args = toConfidentialArguments(
      {
        amount: "5",
        inputToken: usdc.address,
        ledgerWalletApiCompatible: true,
        shareAmountRaw: "5000000",
        useMaxAmount: true,
      },
      encryption,
      cUsdc.address
    );

    expect(args).toEqual({
      encryptedAmount: "0xamount",
      encryptedAmountProof: "0xamountproof",
      encryptedLegAmounts: ["0xleg0", "0xleg1"],
      encryptedLegProof: "0xlegproof",
      inputToken: cUsdc.address,
      ledgerWalletApiCompatible: true,
    });
  });

  it("converts only when the plain underlying token is chosen", () => {
    const yieldDto = confidentialYield();

    expect(getConfidentialConversion(yieldDto, yieldDto.token)).toEqual({
      chainId: 11155111,
      underlying: usdc.address,
      wrapper: cUsdc.address,
    });
    expect(
      getConfidentialConversion(yieldDto, yieldDto.inputTokens[0]!)
    ).toBeNull();
  });

  it("links a mainnet vault to its Zama campaign page", () => {
    expect(
      getConfidentialCampaignUrl(
        confidentialYield({
          id: "ethereum-usdc-zama-rockawayx-usdc-rwa-confidential-vault",
        })
      )
    ).toBe(
      "https://app.zama.org/earn/ethereum/0xc207d3f66537D7F66456808379A0E560cF20Da36/rockawayx-usdc-rwa"
    );
    expect(getConfidentialCampaignUrl(confidentialYield())).toBeNull();
  });

  it("names the contract that holds each hidden balance's handle", () => {
    const yieldDto = confidentialYield();

    expect(
      getConfidentialHandleContract(yieldDto, {
        shareToken: cShare,
        type: "active",
      })
    ).toBe(cShare.address);
    expect(
      getConfidentialHandleContract(yieldDto, {
        shareToken: cUsdc,
        type: "entering",
      })
    ).toBe(depositBatcher);
    expect(
      getConfidentialHandleContract(yieldDto, {
        shareToken: cShare,
        type: "exiting",
      })
    ).toBe(redeemBatcher);
  });

  describe("balance fill", () => {
    const handle = `0x${"ab".repeat(32)}`;
    const hidden = {
      amount: new BigNumber(0),
      amountRaw: 0n,
      amountUsd: null as BigNumber | null,
      isEncrypted: true,
      shareAmount: "0",
      shareAmountRaw: handle,
      shareToken: cShare,
      token: usdc,
    };
    const revealedShares = (shares: bigint) =>
      new Map([
        [Schema.decodeSync(ConfidentialHandle)(handle.toUpperCase()), shares],
      ]);

    it("values revealed shares at the share price and the token USD price", () => {
      const yieldDto = confidentialYieldFixture({
        state: {
          pricePerShareState: {
            price: 1.25,
            quoteToken: usdc,
            shareToken: cShare,
          },
        },
      });

      const filled = fillConfidentialBalance(
        hidden,
        revealedShares(2_000_000n),
        {
          usdPrice: new BigNumber(2),
          yieldDto,
        }
      );

      expect(filled.amount.toFixed()).toBe("2.5");
      expect(filled.amountUsd?.toFixed()).toBe("5");
      expect(filled.shareAmountRaw).toBe("2000000");
    });
  });
});
