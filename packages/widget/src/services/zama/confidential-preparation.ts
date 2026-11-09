import { Data, Effect } from "effect";
import type {
  ActionCommand,
  ManageActionCommand,
} from "../../domain/action/models";
import type { ConfidentialHandle } from "../../domain/earn/balance";
import type {
  ConfidentialChainId,
  ConfidentialConversion,
} from "../../domain/earn/confidential";
import type { EarnYieldWithProvider } from "../../domain/earn/yield-schema";
import type {
  TransactionHash,
  WalletAddress,
} from "../../domain/identity/identifiers";
import type { Token } from "../../domain/token/token";

/**
 * How a confidential vault's action command gets its hidden amount: the
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
  readonly conversion: ConfidentialConversion | null;
  readonly instant: boolean;
  readonly intent: "enter" | "exit";
  /** A deposit whose balance the wallet could never reveal to withdraw. */
  readonly requiresPermitSigner: boolean;
  readonly yieldDto: EarnYieldWithProvider;
}>;

type ConfidentialDecryptPreparation = Readonly<{
  readonly _tag: "Decrypt";
  readonly chainId: ConfidentialChainId;
  readonly command: ManageActionCommand;
  readonly handle: ConfidentialHandle;
}>;

export class ConfidentialPreparationError extends Data.TaggedError(
  "ConfidentialPreparationError"
)<{
  readonly cause: unknown;
  readonly message: string;
  /** False when the request itself cannot be prepared, so retrying cannot help. */
  readonly retryable: boolean;
}> {}

/** What the Zama service does to prepare a confidential vault's action. */
export type ConfidentialPreparationApi = Readonly<{
  /**
   * A deposit's or exit's command with its amount encrypted instead. It asks
   * the wallet for nothing, so Review can prepare the action before confirm.
   */
  readonly encryptCommand: (
    preparation: ConfidentialEncryptPreparation
  ) => Effect.Effect<ActionCommand, ConfidentialPreparationError>;
  /**
   * Fails when a deposit's amount exceeds the hidden balance it spends. A
   * balance already revealed is read from memory; revealing one otherwise
   * may ask the wallet for a permit signature.
   */
  readonly checkConfidentialBalance: (
    preparation: ConfidentialEncryptPreparation
  ) => Effect.Effect<void, ConfidentialPreparationError>;
  /** An unwrap withdrawal's command with its publicly decrypted amount. */
  readonly decryptCommand: (
    preparation: ConfidentialDecryptPreparation
  ) => Effect.Effect<ManageActionCommand, ConfidentialPreparationError>;
  /**
   * The unwrap request an instant exit's mined transaction opened for the
   * owner: the handle its WITHDRAW publicly decrypts.
   */
  readonly readUnwrapRequest: (input: {
    readonly chainId: ConfidentialChainId;
    readonly hash: TransactionHash;
    readonly owner: WalletAddress;
  }) => Effect.Effect<ConfidentialHandle, ConfidentialPreparationError>;
}>;

/** A confidential vault's command, hidden amount prepared, and its intent. */
type ConfidentialPreparedCommand =
  | Readonly<{
      readonly command: ActionCommand;
      readonly intent: "enter" | "exit";
    }>
  | Readonly<{
      readonly command: ManageActionCommand;
      readonly intent: "manage";
    }>;

/**
 * The command whose preview creates a confidential vault's action: its amount
 * encrypted, or its withdrawal decrypted. It asks the wallet for nothing; the
 * balance a deposit spends is checked once the user confirms.
 */
export const prepareConfidentialCommand = (
  zama: Pick<ConfidentialPreparationApi, "decryptCommand" | "encryptCommand">,
  preparation: ConfidentialPreparation
): Effect.Effect<ConfidentialPreparedCommand, ConfidentialPreparationError> =>
  preparation._tag === "Decrypt"
    ? zama
        .decryptCommand(preparation)
        .pipe(Effect.map((command) => ({ command, intent: "manage" as const })))
    : zama
        .encryptCommand(preparation)
        .pipe(
          Effect.map((command) => ({ command, intent: preparation.intent }))
        );
