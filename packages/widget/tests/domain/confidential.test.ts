import { describe, expect, it } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { Schema } from "effect";
import {
  type ConfidentialEncryption,
  fillConfidentialBalance,
  getCancellingHandles,
  getCancelReturn,
  getCancelReturnToken,
  getConfidentialCampaignUrl,
  getConfidentialConversion,
  getConfidentialHandleContract,
  getConfidentialRedeemOperators,
  getPendingActionDecryptHandle,
  isCancellingBalance,
  isConfidentialInstantExit,
  isConfidentialYield,
  isUserRevealableBalance,
  planConfidentialEncryption,
  toConfidentialArguments,
} from "../../src/domain/earn/confidential";
import {
  ConfidentialHandle,
  type EarnBalance,
} from "../../src/domain/earn/models";
import { Token } from "../../src/domain/token/token";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiYieldFixture,
} from "../fixtures";

const { cShare, cUsdc, depositBatcher, redeemBatcher, router, usdc } =
  confidentialFixture;
const confidentialYield = confidentialYieldFixture;
const shareToken = Schema.decodeSync(Token)(cShare);

const toHandle = Schema.decodeSync(ConfidentialHandle);
const amountHandle = toHandle(`0x${"01".repeat(32)}`);
const legHandles = [
  toHandle(`0x${"02".repeat(32)}`),
  toHandle(`0x${"03".repeat(32)}`),
];

const encryption: ConfidentialEncryption = {
  amount: { handle: amountHandle, proof: "0xamountproof" },
  legs: { handles: legHandles, proof: "0xlegproof" },
};

describe("confidential vault rules", () => {
  it("recognises a yield by its router legs and leaves plain yields alone", () => {
    expect(isConfidentialYield(confidentialYield())).toBe(true);
    expect(isConfidentialYield(yieldApiYieldFixture())).toBe(false);
  });

  it("publicly decrypts only an unwrap's WITHDRAW, never a batch cancel", () => {
    const requestId = toHandle(`0x${"cd".repeat(32)}`);
    const hidden = (type: EarnBalance["type"]) => ({
      isEncrypted: true,
      shares: { _tag: "Encrypted", handle: requestId } as const,
      type,
    });

    expect(
      getPendingActionDecryptHandle(hidden("withdrawable"), "WITHDRAW")
    ).toBe(requestId);
    expect(
      getPendingActionDecryptHandle(hidden("entering"), "CANCEL_PENDING")
    ).toBeNull();
    expect(
      getPendingActionDecryptHandle(hidden("exiting"), "CANCEL_PENDING")
    ).toBeNull();
    expect(
      getPendingActionDecryptHandle(
        { shares: { _tag: "Plain", amountRaw: 5n }, type: "withdrawable" },
        "WITHDRAW"
      )
    ).toBeNull();
  });

  it("returns what a cancelled pending request refunds: the confidential asset for a deposit, the vault share for a withdrawal", () => {
    expect(
      getCancelReturnToken(confidentialYield(), "CANCEL_PENDING", {
        type: "entering",
      })?.symbol
    ).toBe(cUsdc.symbol);
    expect(
      getCancelReturnToken(confidentialYield(), "CANCEL_PENDING", {
        shareToken,
        type: "exiting",
      })?.symbol
    ).toBe(cShare.symbol);
    expect(
      getCancelReturnToken(yieldApiYieldFixture(), "CANCEL_PENDING", {
        type: "entering",
      })
    ).toBeNull();
  });

  it("counts a cancelled withdrawal's refund in vault shares, not the underlying it is valued in", () => {
    const refund = getCancelReturn(confidentialYield(), "CANCEL_PENDING", {
      amount: new BigNumber("0.1"),
      shares: { _tag: "Plain", amount: new BigNumber("0.097168") },
      shareToken,
      type: "exiting",
    });

    expect(refund?.token.symbol).toBe(cShare.symbol);
    expect(refund?.amount.toFixed()).toBe("0.097168");
    expect(
      getCancelReturn(confidentialYield(), "CANCEL_PENDING", {
        amount: new BigNumber("2"),
        type: "entering",
      })?.amount.toFixed()
    ).toBe("2");
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

  it("names the router as operator on every redeem leg's share token for a private exit", () => {
    expect(getConfidentialRedeemOperators(confidentialYield())).toEqual({
      chainId: 11155111,
      operator: router,
      tokens: [cShare.address],
    });
    expect(getConfidentialRedeemOperators(yieldApiYieldFixture())).toBeNull();
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
      encryptedAmount: amountHandle,
      encryptedAmountProof: "0xamountproof",
      encryptedLegAmounts: legHandles,
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
        shareToken,
        type: "active",
      })
    ).toBe(cShare.address);
    expect(
      getConfidentialHandleContract(yieldDto, {
        shareToken: Schema.decodeSync(Token)(cUsdc),
        type: "entering",
      })
    ).toBe(depositBatcher);
    expect(
      getConfidentialHandleContract(yieldDto, {
        shareToken,
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
      shares: { _tag: "Encrypted", handle: toHandle(handle) } as const,
      shareToken,
      token: usdc,
    };
    const revealedShares = (shares: bigint) =>
      new Map([[toHandle(handle.toUpperCase()), shares]]);

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
      expect(filled.shares).toEqual({
        _tag: "Revealed",
        amount: new BigNumber("2"),
        amountRaw: 2_000_000n,
        handle,
      });
    });

    it("stays recognisable as its pending position once revealed", () => {
      const filled = fillConfidentialBalance(hidden, revealedShares(1n));
      const cancelling = getCancellingHandles([
        {
          encryptedAmount: handle.toUpperCase(),
          status: "PROCESSING",
          type: "CANCEL_PENDING",
        },
      ]);

      expect(filled).not.toHaveProperty("isEncrypted");
      expect(
        [hidden, filled].map((balance) =>
          isCancellingBalance(balance, cancelling)
        )
      ).toEqual([true, true]);
    });
  });

  it("counts only a broadcast cancel as cancelling its position", () => {
    const handle = (byte: string) => `0x${byte.repeat(64)}`;
    const cancelling = getCancellingHandles([
      {
        encryptedAmount: handle("a"),
        status: "PROCESSING",
        type: "CANCEL_PENDING",
      },
      {
        encryptedAmount: handle("b"),
        status: "SUCCESS",
        type: "CANCEL_PENDING",
      },
      {
        encryptedAmount: handle("c"),
        status: "CREATED",
        type: "CANCEL_PENDING",
      },
      { encryptedAmount: handle("d"), status: "PROCESSING", type: "STAKE" },
      { status: "PROCESSING", type: "CANCEL_PENDING" },
    ]);

    expect([...cancelling]).toEqual([handle("a")]);
  });
});
