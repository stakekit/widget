import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Schema } from "effect";
import type { RefObject } from "react";
import {
  ActionId as BorrowActionId,
  IntegrationId as BorrowIntegrationId,
  TransactionId as BorrowTransactionId,
} from "../../../src/domain/borrow/ids";
import {
  ActionId,
  TransactionId,
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import type {
  SKBorrowSignatureResult,
  SKBorrowTx,
  SKBorrowTxResult,
  SKBorrowWallet,
  SKTransactionResult,
  SKTx,
  SKWallet,
} from "../../../src/public-api/types";
import type { ExternalProviderSnapshot } from "../../../src/services/config/external-provider-snapshot";
import {
  ExternalProvider,
  ExternalProviderCancelled,
} from "../../../src/services/wallet/external-provider";
import type {
  BorrowTransactionMeta,
  YieldTransactionMeta,
} from "../../../src/services/wallet/wallet-transactions";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

const transaction = {
  type: "solana",
  tx: "01020304",
} satisfies SKTx;

const borrowTransaction = {
  type: "evm",
  tx: {
    chainId: "0x1",
    data: "0x1234",
    from: "0x0000000000000000000000000000000000000001",
    gas: "0x5208",
    gasPrice: "0x1",
    to: "0x0000000000000000000000000000000000000002",
    type: "0x0",
    value: undefined,
  },
} satisfies SKBorrowTx;

const typedData = {
  domain: { chainId: 1, name: "Borrow Authorization" },
  message: { owner: "0x0000000000000000000000000000000000000001" },
  primaryType: "Authorization",
  types: {
    Authorization: [{ name: "owner", type: "address" }],
  },
} as const;

const transactionMeta = {
  actionId: Schema.decodeSync(ActionId)("action-id"),
  actionType: "STAKE",
  address,
  amount: "1",
  amountRaw: "1000000000",
  annotatedTransaction: null,
  gasEstimate: undefined,
  inputToken: undefined,
  providersDetails: [],
  rawArguments: null,
  structuredTransaction: null,
  txId: Schema.decodeSync(TransactionId)("transaction-id"),
  txType: "STAKE",
  yieldId: Schema.decodeSync(YieldId)("solana-sol-native-staking"),
} satisfies YieldTransactionMeta;

const borrowTransactionMeta = {
  actionId: Schema.decodeSync(BorrowActionId)("borrow-action-id"),
  actionType: "borrow",
  address,
  integrationId: Schema.decodeSync(BorrowIntegrationId)("aave-v3"),
  rawArguments: {
    amount: "1",
    marketId: "aave-v3-ethereum-usdc",
  },
  txId: Schema.decodeSync(BorrowTransactionId)("borrow-transaction-id"),
  txType: "BORROW",
} satisfies BorrowTransactionMeta;

const makeProviderRef = (
  provider: Extract<ExternalProviderSnapshot, { borrow: false }>["provider"]
): RefObject<ExternalProviderSnapshot> => ({
  current: {
    type: "generic",
    currentAddress: "solana-address",
    currentChain: 501,
    supportedChainIds: [501],
    provider,
    borrow: false,
  },
});

const makeBorrowProviderRef = (
  provider: SKBorrowWallet
): RefObject<ExternalProviderSnapshot> => ({
  current: {
    type: "generic",
    currentAddress: "solana-address",
    currentChain: 501,
    supportedChainIds: [501],
    borrow: true,
    provider,
  },
});

describe("generic external provider callback contract", () => {
  it.effect("uses the live provider when a deferred operation starts", () =>
    Effect.gen(function* () {
      const oldWallet: SKBorrowWallet = {
        signMessage: async () => "old-message",
        signTypedData: async () => ({
          type: "success",
          signature: "old-typed",
        }),
        switchChain: async () => undefined,
        sendTransaction: async () => "old-transaction",
        sendBorrowTransaction: async () => ({
          type: "success",
          txHash: "old-borrow",
        }),
      };
      const ref = makeBorrowProviderRef(oldWallet);
      const provider = new ExternalProvider(ref);
      const send = provider.sendTransaction(transaction, transactionMeta);
      const borrow = provider.sendBorrowTransaction(
        borrowTransaction,
        borrowTransactionMeta
      );
      const sign = provider.signTypedData(typedData, borrowTransactionMeta);
      ref.current = {
        ...ref.current,
        borrow: true,
        provider: {
          ...oldWallet,
          signTypedData: async () => ({
            type: "success",
            signature: "new-typed",
          }),
          sendTransaction: async () => "new-transaction",
          sendBorrowTransaction: async () => ({
            type: "success",
            txHash: "new-borrow",
          }),
        },
      };
      expect(yield* send).toBe("new-transaction");
      expect(yield* borrow).toBe("new-borrow");
      expect(yield* sign).toBe("new-typed");
    })
  );
  it.effect(
    "passes message, chain, transaction, and metadata through Promise callbacks",
    () =>
      Effect.gen(function* () {
        const signMessage = vi.fn(async () => "signed-message");
        const switchChain = vi.fn(async () => undefined);
        const sendTransaction = vi.fn(async () => ({
          type: "success" as const,
          txHash: "broadcast-hash",
        }));
        const provider = new ExternalProvider(
          makeProviderRef({
            signMessage,
            switchChain,
            sendTransaction,
          })
        );

        expect(yield* provider.signMessage("message-hash")).toBe(
          "signed-message"
        );
        expect(yield* provider.switchChain({ chainId: 501 })).toBeUndefined();
        expect(
          yield* provider.sendTransaction(transaction, transactionMeta)
        ).toBe("broadcast-hash");

        expect(signMessage).toHaveBeenCalledWith("message-hash");
        expect(switchChain).toHaveBeenCalledWith(501);
        expect(sendTransaction).toHaveBeenCalledWith(
          transaction,
          transactionMeta
        );
      })
  );

  it.effect(
    "accepts legacy string hashes and preserves host error messages",
    () =>
      Effect.gen(function* () {
        const stringProvider = new ExternalProvider(
          makeProviderRef({
            signMessage: async () => "signed-message",
            switchChain: async () => undefined,
            sendTransaction: async () => "legacy-broadcast-hash",
          })
        );
        const errorProvider = new ExternalProvider(
          makeProviderRef({
            signMessage: async () => "signed-message",
            switchChain: async () => undefined,
            sendTransaction: async () => ({
              type: "error",
              error: "Transaction blocked by host policy",
            }),
          })
        );

        expect(
          yield* stringProvider.sendTransaction(transaction, transactionMeta)
        ).toBe("legacy-broadcast-hash");

        const error = yield* Effect.flip(
          errorProvider.sendTransaction(transaction, transactionMeta)
        );
        expect(error).toMatchObject({
          _tag: "ExternalProviderError",
          customMessage: "Transaction blocked by host policy",
        });
      })
  );

  it.effect(
    "tracks the hash of a transaction the host broadcast before failing",
    () =>
      Effect.gen(function* () {
        const provider = new ExternalProvider(
          makeProviderRef({
            signMessage: async () => "signed-message",
            switchChain: async () => undefined,
            sendTransaction: async () => ({
              type: "error",
              error: "Receipt timed out",
              txHash: "broadcast-hash",
            }),
          })
        );

        expect(
          yield* provider.sendTransaction(transaction, transactionMeta)
        ).toBe("broadcast-hash");
      })
  );

  it.effect("keeps the host error message when its txHash is undefined", () =>
    Effect.gen(function* () {
      const provider = new ExternalProvider(
        makeProviderRef({
          signMessage: async () => "signed-message",
          switchChain: async () => undefined,
          // A host without exactOptionalPropertyTypes may spell "no hash" so.
          sendTransaction: async () =>
            ({
              type: "error",
              error: "Transaction blocked by host policy",
              txHash: undefined,
            }) as unknown as SKTransactionResult,
        })
      );

      const error = yield* Effect.flip(
        provider.sendTransaction(transaction, transactionMeta)
      );
      expect(error).toMatchObject({
        _tag: "ExternalProviderError",
        customMessage: "Transaction blocked by host policy",
      });
    })
  );

  it.effect("reports wallet cancellations from transactions and messages", () =>
    Effect.gen(function* () {
      const provider = new ExternalProvider(
        makeProviderRef({
          signMessage: async () => ({ type: "cancelled" }),
          switchChain: async () => undefined,
          sendTransaction: async () => ({ type: "cancelled" }),
        })
      );

      expect(
        yield* Effect.flip(
          provider.sendTransaction(transaction, transactionMeta)
        )
      ).toBeInstanceOf(ExternalProviderCancelled);
      expect(
        yield* Effect.flip(provider.signMessage("message-hash"))
      ).toBeInstanceOf(ExternalProviderCancelled);
    })
  );

  it.effect(
    "accepts plain and typed message signatures and host message errors",
    () =>
      Effect.gen(function* () {
        const signWith = (signMessage: SKWallet["signMessage"]) =>
          new ExternalProvider(
            makeProviderRef({
              signMessage,
              switchChain: async () => undefined,
              sendTransaction: async () => "hash",
            })
          ).signMessage("message-hash");

        expect(yield* signWith(async () => "plain-signature")).toBe(
          "plain-signature"
        );
        expect(
          yield* signWith(async () => ({
            type: "success",
            signature: "typed-signature",
          }))
        ).toBe("typed-signature");
        expect(
          yield* Effect.flip(
            signWith(async () => ({ type: "error", error: "Wallet locked" }))
          )
        ).toMatchObject({
          _tag: "ExternalProviderError",
          customMessage: "Wallet locked",
        });
        expect(yield* Effect.flip(signWith(async () => ""))).toMatchObject({
          _tag: "ExternalProviderError",
          message: "Invalid external provider result",
        });
      })
  );

  it.effect(
    "sends Borrow transactions and typed data with Borrow metadata",
    () =>
      Effect.gen(function* () {
        const sendTransaction = vi.fn(async () => "yield-hash");
        const sendBorrowTransaction = vi.fn(
          async (): Promise<SKBorrowTxResult> => ({
            type: "success",
            txHash: "borrow-hash",
          })
        );
        const signTypedData = vi.fn(
          async (): Promise<SKBorrowSignatureResult> => ({
            type: "success",
            signature: "typed-signature",
          })
        );
        const wallet = {
          signMessage: async () => "signed-message",
          signTypedData,
          switchChain: async () => undefined,
          sendBorrowTransaction,
          sendTransaction,
        } satisfies SKBorrowWallet;
        const provider = new ExternalProvider(makeBorrowProviderRef(wallet));

        expect(
          yield* provider.sendBorrowTransaction(
            borrowTransaction,
            borrowTransactionMeta
          )
        ).toBe("borrow-hash");
        expect(
          yield* provider.signTypedData(typedData, borrowTransactionMeta)
        ).toBe("typed-signature");

        expect(sendBorrowTransaction).toHaveBeenCalledWith(
          borrowTransaction,
          borrowTransactionMeta
        );
        expect(signTypedData).toHaveBeenCalledWith(
          typedData,
          borrowTransactionMeta
        );
        expect(sendTransaction).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "rejects Borrow invocation when the live provider loses its Borrow capability",
    () =>
      Effect.gen(function* () {
        const wallet: SKBorrowWallet = {
          signMessage: async () => "signed-message",
          signTypedData: async () => ({
            type: "success",
            signature: "typed-signature",
          }),
          switchChain: async () => undefined,
          sendTransaction: async () => "yield-hash",
          sendBorrowTransaction: vi.fn(
            async (): Promise<SKBorrowTxResult> => ({
              type: "success",
              txHash: "borrow-hash",
            })
          ),
        };
        const ref = makeBorrowProviderRef(wallet);
        const provider = new ExternalProvider(ref);
        const pending = provider.sendBorrowTransaction(
          borrowTransaction,
          borrowTransactionMeta
        );
        ref.current = makeProviderRef(wallet).current;
        const error = yield* Effect.flip(pending);

        expect(error).toMatchObject({ _tag: "ExternalProviderError" });
        expect(wallet.sendBorrowTransaction).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "fails Borrow sends on host rejection or a result without a hash",
    () =>
      Effect.gen(function* () {
        const wallet = (
          sendBorrowTransaction: SKBorrowWallet["sendBorrowTransaction"]
        ): SKBorrowWallet => ({
          signMessage: async () => "signed-message",
          signTypedData: async () => ({
            type: "success",
            signature: "typed-signature",
          }),
          switchChain: async () => undefined,
          sendTransaction: async () => "yield-hash",
          sendBorrowTransaction,
        });
        const rejected = new ExternalProvider(
          makeBorrowProviderRef(
            wallet(async () => {
              throw new Error("Borrow blocked by host policy");
            })
          )
        );
        const malformed = new ExternalProvider(
          makeBorrowProviderRef(
            wallet(async () => ({ type: "success", txHash: "" }))
          )
        );

        const rejection = yield* Effect.flip(
          rejected.sendBorrowTransaction(
            borrowTransaction,
            borrowTransactionMeta
          )
        );
        expect(rejection).toMatchObject({
          _tag: "ExternalProviderError",
          customMessage: "Borrow blocked by host policy",
        });

        const invalid = yield* Effect.flip(
          malformed.sendBorrowTransaction(
            borrowTransaction,
            borrowTransactionMeta
          )
        );
        expect(invalid).toMatchObject({
          _tag: "ExternalProviderError",
          message: "Invalid external provider result",
        });
      })
  );
});
