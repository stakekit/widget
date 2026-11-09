import { describe, expect, it } from "@effect/vitest";
import {
  Address,
  beginCell,
  type CommonMessageInfoRelaxedInternal,
  internal,
  storeMessageRelaxed,
} from "@ton/core";
import { Effect, Schema } from "effect";
import { zeroAddress } from "viem";
import type { Connector } from "wagmi";

import {
  ActionId as BorrowActionId,
  IntegrationId as BorrowIntegrationId,
  MarketId as BorrowMarketId,
  TransactionId as BorrowTransactionId,
} from "../../../src/domain/borrow/ids";
import {
  decodeBorrowTransactionForWallet,
  Transaction,
} from "../../../src/domain/borrow/transaction";
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
    marketId: Schema.decodeSync(BorrowMarketId)("aave-v3-ethereum-usdc"),
  },
  txId: Schema.decodeSync(BorrowTransactionId)("borrow-transaction-id"),
  txType: "BORROW",
} satisfies BorrowTransactionMeta;

describe("external-provider wallet driver", () => {
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

  const tonMessage = internal({
    to: Address.parseRaw(
      "0:0000000000000000000000000000000000000000000000000000000000000000"
    ),
    value: 123n,
    body: "Deposit",
  });
  const tonMessageInfo = tonMessage.info as CommonMessageInfoRelaxedInternal;
  const rawTonTransaction = [
    {
      address: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
      amount: "123",
      payload: "te6cckEBAQEAAgAAAA==",
    },
  ];

  it.effect.each([
    {
      name: "a base64 Solana transaction as hex",
      network: "solana",
      tx: "AQIDBA==",
      expected: { type: "solana", tx: "01020304" },
    },
    {
      name: "a hex Solana transaction in lowercase hex",
      network: "solana",
      tx: "0xA1B2",
      expected: { type: "solana", tx: "a1b2" },
    },
    {
      name: "a TON message as its raw transfer",
      network: "ton",
      tx: JSON.stringify({
        seqno: 0,
        message: beginCell()
          .store(storeMessageRelaxed(tonMessage))
          .endCell()
          .toBoc()
          .toString("base64"),
      }),
      expected: {
        type: "ton",
        tx: [
          {
            address: tonMessageInfo.dest.toString(),
            amount: tonMessageInfo.value.coins.toString(),
            payload: tonMessage.body.toBoc().toString("base64"),
          },
        ],
      },
    },
    {
      name: "a raw TON transfer unchanged",
      network: "ton",
      tx: JSON.stringify(rawTonTransaction),
      expected: { type: "ton", tx: rawTonTransaction },
    },
  ] as const)("hands the host $name", ({ network, tx, expected }) =>
    Effect.gen(function* () {
      const received: Array<unknown> = [];
      const connector = {
        id: "externalProviderConnector",
        sendTransaction: (input: unknown, meta: unknown) => {
          received.push(input, meta);
          return Effect.succeed("hash");
        },
      } as unknown as Connector;

      expect(
        yield* makeExternalProviderWalletDriver({ connector }).signTransaction({
          address: "host-address",
          family: "yield",
          network,
          tx,
          txMeta,
        })
      ).toEqual({ broadcasted: true, signedTx: "hash" });
      expect(received).toEqual([expected, txMeta]);
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
