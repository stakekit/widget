import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import type { ActionCommand } from "../../src/domain/earn/action-models";
import { ConfidentialHandle } from "../../src/domain/earn/balance";
import {
  type ConfidentialPreparation,
  getConfidentialOperatorGrants,
  getConfidentialPlannedSteps,
  getConfidentialPreparation,
  getConfidentialRevealState,
  getPendingActionDecryptHandle,
  getShownAmount,
  hasEncryptedBalance,
  isEncryptedBalance,
} from "../../src/domain/earn/confidential-vault";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiYieldFixture,
} from "../fixtures";

const { cShare, cUsdc, router, usdc } = confidentialFixture;
const toHandle = Schema.decodeSync(ConfidentialHandle);
const handle = toHandle(`0x${"cd".repeat(32)}`);
const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);

const hidden = { isEncrypted: true, type: "active" } as const;
const revealed = {
  shares: { _tag: "Revealed", amount: undefined, amountRaw: 5n, handle },
  type: "active",
} as const;
const plain = { type: "active" } as const;

const command = (
  args: NonNullable<ActionCommand["arguments"]>
): ActionCommand => ({
  address,
  arguments: args,
  yieldId: confidentialYieldFixture().id,
});

const enter = (pick: "asset" | "underlying") => {
  const yieldDto = confidentialYieldFixture();
  const token = pick === "asset" ? yieldDto.inputTokens[0]! : yieldDto.token;
  return getConfidentialPreparation({
    command: command({ amount: "5" }),
    intent: "enter",
    token,
    yieldDto,
  });
};

const exit = (outputToken?: string) =>
  getConfidentialPreparation({
    command: command({
      shareAmountRaw: "7000000",
      ...(outputToken ? { outputToken } : {}),
    }),
    intent: "exit",
    yieldDto: confidentialYieldFixture(),
  });

const manage = (decryptHandle: ConfidentialHandle | null) =>
  getConfidentialPreparation({
    command: {
      action: "WITHDRAW",
      address,
      passthrough: "",
      yieldId: confidentialYieldFixture().id,
    },
    handle: decryptHandle,
    intent: "manage",
    yieldDto: confidentialYieldFixture(),
  });

const required = (
  preparation: ConfidentialPreparation | null
): ConfidentialPreparation => {
  if (!preparation) throw new Error("Expected an Action Preparation.");
  return preparation;
};

describe("Confidential Vault: encrypted balances", () => {
  it("treats a balance as encrypted until it is revealed", () => {
    expect(isEncryptedBalance(hidden)).toBe(true);
    expect(isEncryptedBalance(revealed)).toBe(false);
    expect(isEncryptedBalance(plain)).toBe(false);
    expect(hasEncryptedBalance([plain, hidden])).toBe(true);
    expect(hasEncryptedBalance([plain, revealed])).toBe(false);
  });

  it("shows an encrypted balance's amount as unknown, never as its empty API amount", () => {
    expect(getShownAmount(hidden, "0")).toBeNull();
    expect(getShownAmount(revealed, "5")).toBe("5");
    expect(getShownAmount(plain, "5")).toBe("5");
  });

  it("offers Reveal while a revealable balance is encrypted, and names Revealed Balances once all are", () => {
    const vault = confidentialYieldFixture();

    expect(getConfidentialRevealState(vault, [hidden, revealed])).toBe(
      "hidden"
    );
    expect(getConfidentialRevealState(vault, [revealed])).toBe("revealed");
    // An unwrap is decrypted publicly by its WITHDRAW, never revealed.
    expect(
      getConfidentialRevealState(vault, [
        { isEncrypted: true, type: "withdrawable" },
      ])
    ).toBeNull();
    expect(getConfidentialRevealState(yieldApiYieldFixture(), [plain])).toBe(
      null
    );
    expect(getConfidentialRevealState(null, [plain])).toBeNull();
  });
});

describe("Confidential Vault: decrypt handles", () => {
  const encrypted = (type: "entering" | "exiting" | "withdrawable") => ({
    isEncrypted: true,
    shares: { _tag: "Encrypted", handle } as const,
    type,
  });

  it("publicly decrypts only an unfinished Instant Exit's WITHDRAW, never a batch cancel", () => {
    expect(
      getPendingActionDecryptHandle(encrypted("withdrawable"), "WITHDRAW")
    ).toBe(handle);
    expect(
      getPendingActionDecryptHandle(encrypted("entering"), "CANCEL_PENDING")
    ).toBeNull();
    expect(
      getPendingActionDecryptHandle(encrypted("exiting"), "CANCEL_PENDING")
    ).toBeNull();
    expect(
      getPendingActionDecryptHandle(
        { shares: { _tag: "Plain", amountRaw: 5n }, type: "withdrawable" },
        "WITHDRAW"
      )
    ).toBeNull();
  });
});

describe("Confidential Vault: Action Preparation", () => {
  it("encrypts a deposit of the Confidential Token, checking the hidden balance it spends", () => {
    expect(enter("asset")).toMatchObject({
      _tag: "Encrypt",
      amount: 5_000_000n,
      assetAddress: cUsdc.address,
      balance: { token: { address: cUsdc.address } },
      conversion: null,
      instant: false,
      intent: "enter",
      requiresPermitSigner: true,
    });
  });

  it("adds a Confidential Conversion to a deposit of the underlying token", () => {
    expect(enter("underlying")).toMatchObject({
      _tag: "Encrypt",
      balance: null,
      conversion: { underlying: usdc.address, wrapper: cUsdc.address },
      intent: "enter",
    });
  });

  it("encrypts an exit's share count; paid out in the underlying token it is an Instant Exit", () => {
    expect(exit()).toMatchObject({
      _tag: "Encrypt",
      amount: 7_000_000n,
      conversion: null,
      instant: false,
      intent: "exit",
      requiresPermitSigner: false,
    });
    expect(exit(usdc.address)).toMatchObject({
      _tag: "Encrypt",
      instant: true,
      intent: "exit",
    });
  });

  it("decrypts a Manage action only when its balance has a decrypt handle", () => {
    expect(manage(handle)).toMatchObject({ _tag: "Decrypt", handle });
    expect(manage(null)).toBeNull();
  });

  it("needs no preparation outside a Confidential Vault", () => {
    const yieldDto = yieldApiYieldFixture();
    expect(
      getConfidentialPreparation({
        command: command({ amount: "5" }),
        intent: "enter",
        token: yieldDto.token,
        yieldDto,
      })
    ).toBeNull();
    expect(
      getConfidentialPreparation({
        command: command({ shareAmountRaw: "7" }),
        intent: "exit",
        yieldDto,
      })
    ).toBeNull();
  });
});

describe("Confidential Vault: Planned Steps", () => {
  it("lists a deposit's DEPOSIT", () => {
    expect(
      getConfidentialPlannedSteps(required(enter("asset")), {
        missingOperatorGrants: 0,
      })
    ).toEqual(["DEPOSIT"]);
  });

  it("lists a private exit's missing operator grants before its redeem", () => {
    const preparation = required(exit());
    expect(
      getConfidentialPlannedSteps(preparation, { missingOperatorGrants: 2 })
    ).toEqual(["SET_OPERATOR", "SET_OPERATOR", "REDEEM"]);
    expect(
      getConfidentialPlannedSteps(preparation, { missingOperatorGrants: 0 })
    ).toEqual(["REDEEM"]);
  });

  it("lists an Instant Exit's unwrap and its Unwrap Finalize", () => {
    expect(
      getConfidentialPlannedSteps(required(exit(usdc.address)), {
        missingOperatorGrants: 0,
      })
    ).toEqual(["UNWRAP", "DECRYPT", "WITHDRAW", "REDEEM"]);
  });

  it("lists a decrypted withdrawal's WITHDRAW and redeem", () => {
    expect(
      getConfidentialPlannedSteps(required(manage(handle)), {
        missingOperatorGrants: 0,
      })
    ).toEqual(["WITHDRAW", "REDEEM"]);
  });

  it("checks operator grants for a private exit only", () => {
    expect(getConfidentialOperatorGrants(required(exit()))).toEqual({
      chainId: 11155111,
      operator: router,
      tokens: [cShare.address],
    });
    expect(
      getConfidentialOperatorGrants(required(exit(usdc.address)))
    ).toBeNull();
    expect(getConfidentialOperatorGrants(required(enter("asset")))).toBeNull();
    expect(getConfidentialOperatorGrants(required(manage(handle)))).toBeNull();
  });
});
