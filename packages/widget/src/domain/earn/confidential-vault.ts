import { toBaseUnits } from "../finance/base-units";
import { exactDecimal } from "../finance/exact";
import type { Token } from "../token/token";
import type {
  ActionCommand,
  ActionTransaction,
  ManageActionCommand,
  YieldPendingActionType,
} from "./action-models";
import {
  type ConfidentialHandle,
  type EarnBalance,
  getEncryptedHandle,
} from "./balance";
import {
  type ConfidentialChainId,
  type ConfidentialConversion,
  getConfidentialAssetToken,
  getConfidentialChainId,
  getConfidentialConversion,
  getConfidentialRedeemOperators,
  isConfidentialInstantExit,
  isConfidentialYield,
} from "./confidential";
import {
  isUnfinishedInstantExit,
  isUserRevealableBalance,
} from "./confidential-balance";
import type { EarnYieldWithProvider } from "./yield-schema";

/*
 * The Confidential Vault capability: what Features ask about a Confidential
 * Vault's balances and actions instead of reading encryption flags, handles
 * and step types themselves.
 */

/**
 * A balance as the capability reads it. `type` keeps the parameter from being
 * a weak type, so a Revealed Balance, which drops `isEncrypted`, still fits.
 */
type EncryptionFlag = Pick<EarnBalance, "isEncrypted" | "type">;

/**
 * Whether a balance's amount is still a Confidential Handle: an Unknown Earn
 * Balance until its owner reveals it. A Revealed Balance is not encrypted.
 */
export const isEncryptedBalance = (balance: EncryptionFlag): boolean =>
  balance.isEncrypted === true;

export const hasEncryptedBalance = (
  balances: ReadonlyArray<EncryptionFlag>
): boolean => balances.some(isEncryptedBalance);

/**
 * The amount a balance shows: null while it is encrypted, as the API's empty
 * amount for it is unknown, not zero.
 */
export const getShownAmount = <A>(
  balance: EncryptionFlag,
  amount: A
): A | null => (isEncryptedBalance(balance) ? null : amount);

/**
 * What a position offers its owner: Reveal while a balance they can decrypt
 * is hidden, or "revealed" once a Confidential Vault's balances all show.
 * Null when there is nothing to reveal.
 */
export const getConfidentialRevealState = (
  yieldDto: EarnYieldWithProvider | null,
  balances: ReadonlyArray<Pick<EarnBalance, "isEncrypted" | "type">>
): "hidden" | "revealed" | null => {
  if (balances.some(isUserRevealableBalance)) return "hidden";
  return yieldDto &&
    isConfidentialYield(yieldDto) &&
    balances.some(
      (balance) =>
        !isEncryptedBalance(balance) && balance.type !== "withdrawable"
    )
    ? "revealed"
    : null;
};

/**
 * The Confidential Handle a pending action's Decrypt step reveals: only an
 * unfinished Instant Exit's WITHDRAW decrypts its unwrapped amount publicly.
 */
export const getPendingActionDecryptHandle = (
  balance: Pick<EarnBalance, "isEncrypted" | "shares" | "type">,
  pendingActionType: YieldPendingActionType
): ConfidentialHandle | null =>
  isUnfinishedInstantExit(balance, pendingActionType)
    ? getEncryptedHandle(balance)
    : null;

/**
 * How an Action Preparation gets a confidential action's hidden amount: the
 * amount encrypted for the signing wallet, or a withdrawal decrypted publicly.
 */
export type ConfidentialPreparation =
  | ConfidentialEncryptPreparation
  | ConfidentialDecryptPreparation;

export type ConfidentialEncryptPreparation = Readonly<{
  readonly _tag: "Encrypt";
  readonly amount: bigint;
  readonly assetAddress: string | null;
  /** The hidden balance `amount` must not exceed, if it is not wrapped first. */
  readonly balance: Readonly<{
    readonly chainId: ConfidentialChainId;
    readonly token: Token;
  }> | null;
  readonly command: ActionCommand;
  /** The Confidential Conversion a deposit of the underlying token runs first. */
  readonly conversion: ConfidentialConversion | null;
  readonly instant: boolean;
  readonly intent: "enter" | "exit";
  /** A deposit whose balance the wallet could never reveal to withdraw. */
  readonly requiresPermitSigner: boolean;
  readonly yieldDto: EarnYieldWithProvider;
}>;

export type ConfidentialDecryptPreparation = Readonly<{
  readonly _tag: "Decrypt";
  readonly chainId: ConfidentialChainId;
  readonly command: ManageActionCommand;
  readonly handle: ConfidentialHandle;
}>;

/** An entry, exit or manage a Confidential Vault may need to prepare. */
export type ConfidentialActionRequest =
  | Readonly<{
      readonly command: ActionCommand;
      readonly intent: "enter";
      /** The token the user deposits: the Confidential Token or its underlying. */
      readonly token: Token;
      readonly yieldDto: EarnYieldWithProvider;
    }>
  | Readonly<{
      readonly command: ActionCommand;
      readonly intent: "exit";
      readonly yieldDto: EarnYieldWithProvider;
    }>
  | Readonly<{
      readonly command: ManageActionCommand;
      /** See `getPendingActionDecryptHandle`. */
      readonly handle: ConfidentialHandle | null;
      readonly intent: "manage";
      readonly yieldDto: EarnYieldWithProvider;
    }>;

/**
 * The Action Preparation a confidential action needs once confirmed, in
 * place of an Action Preview. Null when it needs none: outside a Confidential
 * Vault, or for a manage with nothing to decrypt.
 */
export const getConfidentialPreparation = (
  request: ConfidentialActionRequest
): ConfidentialPreparation | null => {
  switch (request.intent) {
    case "enter": {
      const { command, token, yieldDto } = request;
      const asset = getConfidentialAssetToken(yieldDto);
      const amount = command.arguments?.amount;
      if (!asset?.address || amount === undefined) return null;
      const conversion = getConfidentialConversion(yieldDto, token);
      const chainId = getConfidentialChainId(yieldDto);
      return {
        _tag: "Encrypt",
        amount: toBaseUnits(exactDecimal(amount), token.decimals, "truncate"),
        assetAddress: asset.address,
        // A hidden balance is checked only once confirmed, not on the form.
        balance: conversion || chainId === null ? null : { chainId, token },
        conversion,
        instant: false,
        command,
        intent: "enter",
        requiresPermitSigner: true,
        yieldDto,
      };
    }
    case "exit": {
      const { command, yieldDto } = request;
      const shares = command.arguments?.shareAmountRaw;
      if (!isConfidentialYield(yieldDto) || shares === undefined) return null;
      return {
        _tag: "Encrypt",
        amount: BigInt(shares),
        assetAddress: null,
        balance: null,
        conversion: null,
        instant: isConfidentialInstantExit(
          yieldDto,
          command.arguments?.outputToken
        ),
        command,
        intent: "exit",
        requiresPermitSigner: false,
        yieldDto,
      };
    }
    case "manage": {
      const chainId = getConfidentialChainId(request.yieldDto);
      return request.handle && chainId !== null
        ? {
            _tag: "Decrypt",
            chainId,
            handle: request.handle,
            command: request.command,
          }
        : null;
    }
  }
};

/** A Planned Step: an API transaction, or an Unwrap Finalize's DECRYPT. */
export type ConfidentialPlannedStep = ActionTransaction["type"] | "DECRYPT";

/**
 * Which Action Preparation a step runs in the browser, encrypting or
 * decrypting an amount; null for a step the wallet signs.
 */
export const getConfidentialPreparationStep = (
  type: string
): "decrypt" | "encrypt" | null => {
  if (type === "ENCRYPT") return "encrypt";
  return type === "DECRYPT" ? "decrypt" : null;
};

/**
 * The operator grants a private exit's redeem needs: the router on every
 * redeem leg's share token. Null for any other preparation.
 */
export const getConfidentialOperatorGrants = (
  preparation: ConfidentialPreparation
) =>
  preparation._tag === "Encrypt" &&
  preparation.intent === "exit" &&
  !preparation.instant
    ? getConfidentialRedeemOperators(preparation.yieldDto)
    : null;

/**
 * The Planned Steps of a prepared action: what it creates only after its
 * amount is encrypted or decrypted, listed until the API returns them. A
 * private exit first grants the router on each share token not yet granted;
 * an Instant Exit then finalizes its unwrap in the same flow; a decrypted
 * withdrawal finalizes the unwrap, then redeems the vault shares.
 */
export const getConfidentialPlannedSteps = (
  preparation: ConfidentialPreparation,
  { missingOperatorGrants }: { readonly missingOperatorGrants: number }
): ReadonlyArray<ConfidentialPlannedStep> => {
  if (preparation._tag === "Decrypt") return ["WITHDRAW", "REDEEM"];
  if (preparation.intent === "enter") return ["DEPOSIT"];
  return preparation.instant
    ? ["UNWRAP", "DECRYPT", "WITHDRAW", "REDEEM"]
    : [
        ...Array.from(
          { length: missingOperatorGrants },
          () => "SET_OPERATOR" as const
        ),
        "REDEEM",
      ];
};
