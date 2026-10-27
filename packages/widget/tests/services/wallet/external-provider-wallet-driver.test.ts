import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";
import { zeroAddress } from "viem";
import type { Connector } from "wagmi";
import {
  decodeBorrowTransactionForWallet,
  Transaction,
} from "../../../src/domain/borrow/execution/transaction";
import {
  ActionId as BorrowActionId,
  IntegrationId as BorrowIntegrationId,
  TransactionId as BorrowTransactionId,
} from "../../../src/domain/borrow/ids";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { ExternalProviderError } from "../../../src/services/wallet/external-provider";
import { makeExternalProviderWalletDriver } from "../../../src/services/wallet/internal/adapters/external-provider/driver";
import type { BorrowTransactionMeta } from "../../../src/services/wallet/wallet-transactions";

const tx = JSON.stringify({
  chainId: 1,
  data: "0x1234",
  from: zeroAddress,
  gasLimit: "21000",
  gasPrice: "1",
  nonce: 1,
  to: zeroAddress,
  type: 0,
});

const typedData = {
  domain: { chainId: 1, name: "Borrow Authorization" },
  message: { owner: zeroAddress },
  primaryType: "Authorization",
  types: {
    Authorization: [{ name: "owner", type: "address" }],
  },
} as const;

type ExternalProviderTransactionInput = Parameters<
  ReturnType<typeof makeExternalProviderWalletDriver>["signTransaction"]
>[0];

const txMeta = {} as Extract<
  ExternalProviderTransactionInput,
  { readonly family: "yield" }
>["txMeta"];

const borrowTxMeta = {
  actionId: Schema.decodeSync(BorrowActionId)("borrow-action-id"),
  actionType: "borrow",
  address: Schema.decodeSync(WalletAddress)(zeroAddress),
  integrationId: Schema.decodeSync(BorrowIntegrationId)("aave-v3"),
  rawArguments: {
    amount: "1",
    marketId: "aave-v3-ethereum-usdc",
  },
  txId: Schema.decodeSync(BorrowTransactionId)("borrow-transaction-id"),
  txType: "BORROW",
} satisfies BorrowTransactionMeta;

describe("external-provider wallet driver", () => {
  it.effect(
    "routes typed data and Borrow metadata through the host signing capability",
    () =>
      Effect.gen(function* () {
        const signTypedData = vi.fn(() => Effect.succeed("typed-signature"));
        const connector = {
          id: "externalProviderConnector",
          signTypedData,
        } as unknown as Connector;

        expect(
          yield* makeExternalProviderWalletDriver({ connector }).signTypedData({
            txMeta: borrowTxMeta,
            typedData,
          })
        ).toBe("typed-signature");
        expect(signTypedData).toHaveBeenCalledWith(typedData, borrowTxMeta);
      })
  );

  it.effect(
    "reads fresh host callbacks and preserves their Promise contract",
    () =>
      Effect.gen(function* () {
        const callbacks: {
          signMessage: (message: string) => Promise<string>;
          sendTransaction: (input: unknown, meta: unknown) => Promise<string>;
        } = {
          signMessage: async () => "first-message",
          sendTransaction: async () => "first-hash",
        };
        const connector = {
          id: "externalProviderConnector",
          signMessage: (message: string) =>
            Effect.tryPromise(() => callbacks.signMessage(message)),
          sendTransaction: (input: unknown, meta: unknown) =>
            Effect.tryPromise(() => callbacks.sendTransaction(input, meta)),
        } as unknown as Connector;
        const driver = makeExternalProviderWalletDriver({ connector });

        expect(yield* driver.signMessage({ message: "message" })).toBe(
          "first-message"
        );

        callbacks.signMessage = async () => "second-message";
        callbacks.sendTransaction = async () => "second-hash";

        expect(yield* driver.signMessage({ message: "message" })).toBe(
          "second-message"
        );
        expect(
          yield* driver.signTransaction({
            address: zeroAddress,
            family: "yield",
            network: "ethereum",
            tx,
            txMeta,
          })
        ).toEqual({ broadcasted: true, signedTx: "second-hash" });
      })
  );

  it.effect("maps host custom errors to the broadcast failure", () =>
    Effect.gen(function* () {
      const connector = {
        id: "externalProviderConnector",
        sendTransaction: () =>
          Effect.fail(
            new ExternalProviderError({
              customMessage: "Open your host wallet",
              message: "Open your host wallet",
            })
          ),
      } as unknown as Connector;
      const failure = yield* Effect.flip(
        makeExternalProviderWalletDriver({ connector }).signTransaction({
          address: zeroAddress,
          family: "yield",
          network: "ethereum",
          tx,
          txMeta,
        })
      );

      expect(failure._tag).toBe("WalletBroadcastError");
      if (failure._tag === "WalletBroadcastError") {
        expect(failure.customMessage).toBe("Open your host wallet");
      }
    })
  );

  it.effect(
    "routes Borrow transactions through the Borrow connector capability",
    () =>
      Effect.gen(function* () {
        let yieldCalls = 0;
        let borrowCalls = 0;
        const connector = {
          id: "externalProviderConnector",
          sendBorrowTransaction: () => {
            borrowCalls += 1;
            return Effect.succeed("borrow-hash");
          },
          sendTransaction: () => {
            yieldCalls += 1;
            return Effect.succeed("yield-hash");
          },
        } as unknown as Connector;

        expect(
          yield* makeExternalProviderWalletDriver({
            connector,
          }).signTransaction({
            address: zeroAddress,
            family: "borrow",
            network: "ethereum",
            tx,
            txMeta: borrowTxMeta,
          })
        ).toEqual({ broadcasted: true, signedTx: "borrow-hash" });

        expect(borrowCalls).toBe(1);
        expect(yieldCalls).toBe(0);
      })
  );

  it.effect("never passes a quoted nonce to the host wallet", () =>
    Effect.gen(function* () {
      const received: Array<unknown> = [];
      const connector = {
        id: "externalProviderConnector",
        sendBorrowTransaction: (input: unknown) => {
          received.push(input);
          return Effect.succeed("borrow-hash");
        },
        sendTransaction: (input: unknown) => {
          received.push(input);
          return Effect.succeed("yield-hash");
        },
      } as unknown as Connector;
      const driver = makeExternalProviderWalletDriver({ connector });

      yield* driver.signTransaction({
        address: zeroAddress,
        family: "yield",
        network: "ethereum",
        tx,
        txMeta,
      });
      yield* driver.signTransaction({
        address: zeroAddress,
        family: "borrow",
        network: "ethereum",
        tx,
        txMeta: borrowTxMeta,
      });

      expect(received).toEqual([
        {
          type: "evm",
          tx: {
            chainId: "0x1",
            data: "0x1234",
            from: zeroAddress,
            gas: "0x5208",
            gasPrice: "0x1",
            to: zeroAddress,
            type: "0x1",
            value: undefined,
          },
        },
        {
          type: "evm",
          tx: {
            chainId: "0x1",
            data: "0x1234",
            from: zeroAddress,
            gas: "0x5208",
            gasPrice: "0x1",
            to: zeroAddress,
            type: "0x0",
            value: undefined,
          },
        },
      ]);
    })
  );

  const borrowApiTransaction = (signablePayload: Record<string, unknown>) =>
    Schema.decodeSync(Transaction)({
      address: zeroAddress,
      chainId: "8453",
      id: "borrow-transaction-id",
      network: "base",
      signablePayload: JSON.stringify({
        data: "0x1234",
        from: zeroAddress,
        gasLimit: "21000",
        to: zeroAddress,
        ...signablePayload,
      }),
      signingFormat: "EVM_TRANSACTION",
      status: "WAITING_FOR_SIGNATURE",
      type: "BORROW",
    });

  it.effect.each([
    {
      expected: {
        maxFeePerGas: "0x9",
        maxPriorityFeePerGas: "0x2",
        type: "0x2",
      },
      name: "an EIP-1559 payload with its fees",
      payload: { maxFeePerGas: "9", maxPriorityFeePerGas: "2", type: 2 },
    },
    {
      expected: {
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
        type: "0x2",
      },
      name: "an EIP-1559 payload without fees",
      payload: { type: 2 },
    },
    {
      expected: { gasPrice: "0x7", type: "0x0" },
      name: "a legacy payload with its gas price",
      payload: { gasPrice: "7", type: 0 },
    },
    {
      expected: { gasPrice: undefined, type: "0x0" },
      name: "an untyped payload as legacy",
      payload: {},
    },
  ])("hands the host $name", ({ expected, payload }) =>
    Effect.gen(function* () {
      let received: unknown;
      const connector = {
        id: "externalProviderConnector",
        sendBorrowTransaction: (input: unknown) => {
          received = input;
          return Effect.succeed("borrow-hash");
        },
      } as unknown as Connector;
      const walletPayload = yield* decodeBorrowTransactionForWallet(
        borrowApiTransaction(payload)
      );

      yield* makeExternalProviderWalletDriver({ connector }).signTransaction({
        address: zeroAddress,
        family: "borrow",
        network: "base",
        tx: walletPayload,
        txMeta: borrowTxMeta,
      });

      expect(received).toEqual({
        type: "evm",
        tx: {
          chainId: "0x2105",
          data: "0x1234",
          from: zeroAddress,
          gas: "0x5208",
          to: zeroAddress,
          ...expected,
        },
      });
    })
  );

  it.effect("rejects a Borrow payload with an unsupported type", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeBorrowTransactionForWallet(borrowApiTransaction({ type: 1 }))
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect(
    "fails invalid host transaction payloads before invoking the callback",
    () =>
      Effect.gen(function* () {
        let calls = 0;
        const connector = {
          id: "externalProviderConnector",
          sendTransaction: () => {
            calls += 1;
            return Effect.succeed("hash");
          },
        } as unknown as Connector;
        const failure = yield* Effect.flip(
          makeExternalProviderWalletDriver({ connector }).signTransaction({
            address: zeroAddress,
            family: "yield",
            network: "ethereum",
            tx: JSON.stringify({ ...JSON.parse(tx), to: undefined }),
            txMeta,
          })
        );

        expect(failure._tag).toBe("WalletDecodeError");
        expect(calls).toBe(0);
      })
  );
});
