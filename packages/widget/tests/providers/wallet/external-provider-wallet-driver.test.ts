import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { zeroAddress } from "viem";
import type { Connector } from "wagmi";
import { ExternalProviderError } from "../../../src/services/wallet/external-provider";
import { makeExternalProviderWalletDriver } from "../../../src/services/wallet/internal/adapters/external-provider/driver";

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

const txWithoutNonce = JSON.stringify({
  chainId: 1,
  data: "0x1234",
  from: zeroAddress,
  gasLimit: "21000",
  gasPrice: "1",
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
  { readonly family: "classic" }
>["txMeta"];

describe("external-provider wallet driver", () => {
  it.effect("routes typed data through the host signing capability", () =>
    Effect.gen(function* () {
      const signTypedData = vi.fn(() => Effect.succeed("typed-signature"));
      const connector = {
        id: "externalProviderConnector",
        signTypedData,
      } as unknown as Connector;

      expect(
        yield* makeExternalProviderWalletDriver({ connector }).signTypedData(
          typedData
        )
      ).toBe("typed-signature");
      expect(signTypedData).toHaveBeenCalledWith(typedData);
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
            family: "classic",
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
          family: "classic",
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
        let classicCalls = 0;
        let borrowCalls = 0;
        const connector = {
          id: "externalProviderConnector",
          sendBorrowTransaction: () => {
            borrowCalls += 1;
            return Effect.succeed("borrow-hash");
          },
          sendTransaction: () => {
            classicCalls += 1;
            return Effect.succeed("classic-hash");
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
            txMeta: {
              actionId: "borrow-action-id",
              actionType: "borrow",
              address: zeroAddress,
              integrationId: "aave-v3",
              rawArguments: {
                amount: "1",
                marketId: "aave-v3-ethereum-usdc",
              },
              txId: "borrow-transaction-id",
              txType: "BORROW",
            },
          })
        ).toEqual({ broadcasted: true, signedTx: "borrow-hash" });

        expect(borrowCalls).toBe(1);
        expect(classicCalls).toBe(0);
      })
  );

  it.effect(
    "leaves an omitted Borrow nonce for the host wallet to select",
    () =>
      Effect.gen(function* () {
        let received: unknown;
        const connector = {
          id: "externalProviderConnector",
          sendBorrowTransaction: (input: unknown) => {
            received = input;
            return Effect.succeed("borrow-hash");
          },
        } as unknown as Connector;

        yield* makeExternalProviderWalletDriver({ connector }).signTransaction({
          address: zeroAddress,
          family: "borrow",
          network: "ethereum",
          tx: txWithoutNonce,
          txMeta: {
            actionId: "borrow-action-id",
            actionType: "borrow",
            address: zeroAddress,
            integrationId: "aave-v3",
            rawArguments: {
              amount: "1",
              marketId: "aave-v3-ethereum-usdc",
            },
            txId: "borrow-transaction-id",
            txType: "BORROW",
          },
        });

        expect(received).toEqual({
          type: "evm",
          tx: {
            chainId: "0x1",
            data: "0x1234",
            from: zeroAddress,
            gas: "0x5208",
            gasPrice: "0x1",
            to: zeroAddress,
            type: "0x1",
          },
        });
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
            family: "classic",
            network: "ethereum",
            tx: txWithoutNonce,
            txMeta,
          })
        );

        expect(failure._tag).toBe("WalletDecodeError");
        expect(calls).toBe(0);
      })
  );
});
