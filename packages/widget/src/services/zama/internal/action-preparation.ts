import { Effect, HashMap, Option } from "effect";
import { isHex } from "viem";
import {
  planConfidentialEncryption,
  toConfidentialArguments,
} from "../../../domain/earn/confidential";
import { ConfidentialTokenBalanceKey } from "../../../domain/earn/confidential-balance";
import { WalletService } from "../../wallet/wallet-service";
import {
  type ConfidentialEncryptPreparation,
  type ConfidentialPreparationApi,
  ConfidentialPreparationError,
} from "../confidential-preparation";
import { RevealedBalances } from "../revealed-balances";
import {
  findUnwrapRequest,
  readUnwrapReceipt,
  readWrappedAmount,
} from "./confidential-contracts";
import type { ZamaSdkAdapter } from "./sdk";
import { toEvmAddress, type ZamaError } from "./zama-error";

const retryableFailure = (error: ZamaError) =>
  new ConfidentialPreparationError({
    cause: error,
    message: `Zama ${error.operation} failed.`,
    retryable: true,
  });

const unpreparable = (message: string, cause: unknown = null) =>
  new ConfidentialPreparationError({ cause, message, retryable: false });

/**
 * Prepares confidential vaults' action commands. `revealTokenBalance` reveals
 * and stores a hidden balance; `sdk` encrypts and decrypts publicly.
 */
export const makeConfidentialPreparation = Effect.fn(
  "makeConfidentialPreparation"
)(function* ({
  revealTokenBalance,
  sdk,
}: {
  readonly revealTokenBalance: ZamaSdkAdapter["decryptTokenBalance"];
  readonly sdk: ZamaSdkAdapter;
}) {
  const wallet = yield* WalletService;
  const values = yield* RevealedBalances;

  /** A deposit the wallet could never reveal again is not prepared. */
  const requirePermitSigner = Effect.fn("ZamaService.requirePermitSigner")(
    function* (preparation: ConfidentialEncryptPreparation) {
      if (!preparation.requiresPermitSigner) return;
      const canSignPermit = yield* wallet.canSignPermit.pipe(
        Effect.mapError(
          (cause) =>
            new ConfidentialPreparationError({
              cause,
              message: "Wallet state is unavailable.",
              retryable: true,
            })
        )
      );
      if (!canSignPermit) {
        return yield* unpreparable(
          "This wallet cannot reveal confidential balances."
        );
      }
    }
  );

  const checkConfidentialBalance: ConfidentialPreparationApi["checkConfidentialBalance"] =
    Effect.fn("ZamaService.checkConfidentialBalance")(function* (preparation) {
      const { amount, balance: spent, command } = preparation;
      if (!spent) return;
      const owner = command.address;
      const revealed = HashMap.get(
        (yield* values.current).tokenBalances,
        new ConfidentialTokenBalanceKey({ owner, token: spent.token })
      );
      // Only revealing it asks the wallet for a permit.
      const balance = Option.isSome(revealed)
        ? revealed.value
        : yield* requirePermitSigner(preparation).pipe(
            Effect.andThen(
              revealTokenBalance({
                chainId: spent.chainId,
                owner,
                token: spent.token,
              }).pipe(Effect.mapError(retryableFailure))
            )
          );
      if (balance < amount) {
        return yield* unpreparable("Amount exceeds the confidential balance.", {
          amount,
          balance,
        });
      }
    });

  const encryptCommand: ConfidentialPreparationApi["encryptCommand"] =
    Effect.fn("ZamaService.encryptCommand")(function* (preparation) {
      const { amount, command } = preparation;
      const owner = command.address;
      yield* requirePermitSigner(preparation);
      const value = preparation.conversion
        ? yield* readWrappedAmount(sdk, {
            amount,
            conversion: preparation.conversion,
          }).pipe(Effect.mapError(retryableFailure))
        : amount;
      const plan = planConfidentialEncryption({
        instant: preparation.instant,
        intent: preparation.intent,
        value,
        yieldDto: preparation.yieldDto,
      });
      if (!plan) return command;
      const encryption = yield* sdk
        .encrypt({ owner, plan })
        .pipe(Effect.mapError(retryableFailure));
      return {
        ...command,
        arguments: toConfidentialArguments(
          command.arguments ?? {},
          encryption,
          preparation.assetAddress
        ),
      };
    });

  const decryptCommand: ConfidentialPreparationApi["decryptCommand"] = ({
    chainId,
    command,
    handle,
  }) =>
    sdk
      .publicDecrypt({ chainId, owner: command.address, requestId: handle })
      .pipe(
        Effect.map(({ cleartext, decryptionProof }) => ({
          ...command,
          arguments: {
            ...command.arguments,
            decryptedAmount: cleartext.toString(),
            decryptionProof,
          },
        })),
        Effect.mapError(retryableFailure)
      );

  const readUnwrapRequest: ConfidentialPreparationApi["readUnwrapRequest"] =
    Effect.fn("ZamaService.readUnwrapRequest")(function* ({
      chainId,
      hash,
      owner,
    }) {
      // viem takes hex, and an EVM transaction's hash is in it.
      if (!isHex(hash)) {
        return yield* unpreparable(
          "The unwrap transaction hash is not hex.",
          hash
        );
      }
      const receipt = yield* readUnwrapReceipt(sdk, { chainId, hash }).pipe(
        Effect.mapError(retryableFailure)
      );
      const receiver = yield* toEvmAddress(owner, "read-unwrap-receipt").pipe(
        Effect.mapError((error) =>
          unpreparable("The unwrap owner is not an EVM address.", error)
        )
      );
      const requestId = findUnwrapRequest(receipt, receiver);
      return Option.isSome(requestId)
        ? requestId.value
        : yield* unpreparable("The transaction requested no unwrap.", receipt);
    });

  return {
    checkConfidentialBalance,
    decryptCommand,
    encryptCommand,
    readUnwrapRequest,
  } satisfies ConfidentialPreparationApi;
});
