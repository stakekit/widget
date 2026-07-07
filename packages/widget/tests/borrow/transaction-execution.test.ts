import { Cause, Effect, Exit, Fiber, Option, Stream } from "effect";
import { EitherAsync, Left, Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";
import {
  type Action,
  type BorrowExecutionEvent,
  BorrowExecutionEventsService,
  BorrowPayloadDecodeError,
  BorrowSigningFailedError,
  BorrowWalletDisconnectedError,
  type BorrowWalletSignRequest,
  decodeBorrowEvmTransactionForWallet,
  getBorrowTransactionSubmitPayload,
  makeDisconnectedBorrowWalletExecutionAdapter,
  makeSKWalletBorrowExecutionAdapter,
  type Transaction,
  type WalletState,
} from "../../src/borrow";
import type { Networks } from "../../src/domain/types/chains/networks";
import type { SKWallet } from "../../src/domain/types/wallet";
import { SendTransactionError } from "../../src/providers/sk-wallet/errors";

const address = "0x0000000000000000000000000000000000000001";
const transactionHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

const transaction = {
  address,
  chainId: "8453",
  id: "tx-1",
  network: "base",
  signablePayload: JSON.stringify({
    data: "0xabcdef",
    from: address,
    gasLimit: "21000",
    to: "0x0000000000000000000000000000000000000002",
    value: "0",
  }),
  signingFormat: "EVM_TRANSACTION",
  status: "WAITING_FOR_SIGNATURE",
  type: "BORROW",
} as const;

const action = {
  address,
  action: "borrow",
  id: "action-1",
  integrationId: "morpho-blue",
} as Action;

const connectedWalletState = {
  accounts: [{ address }],
  chains: [],
  currentAccount: { address },
  currentChain: {
    chainId: 8453 as never,
    iconUrl: "",
    name: "Base",
    network: "base",
  },
  network: "base",
  status: "connected",
} as unknown as WalletState;

const makeSignRequest = (): BorrowWalletSignRequest => ({
  action,
  network: "base" as Networks,
  transaction: {
    chainId: 8453,
    id: "tx-1",
    network: "base",
  } as Transaction,
  tx: "{}",
  txMeta: {} as never,
});

const getExitError = <E>(exit: Exit.Exit<unknown, E>) => {
  expect(Exit.isFailure(exit)).toBe(true);

  if (Exit.isSuccess(exit)) {
    throw new Error("Expected failure exit.");
  }

  const error = Cause.findErrorOption(exit.cause);

  expect(Option.isSome(error)).toBe(true);

  if (Option.isNone(error)) {
    throw new Error("Expected typed failure cause.");
  }

  return error.value;
};

describe("borrow transaction execution runtime", () => {
  it("decodes borrow EVM payloads through Schema for wallet signing", async () => {
    const unsignedTx = JSON.parse(
      await Effect.runPromise(
        decodeBorrowEvmTransactionForWallet({
          action,
          transaction: transaction as unknown as Transaction,
        })
      )
    );

    expect(unsignedTx).toMatchObject({
      chainId: 8453,
      data: "0xabcdef",
      from: address,
      gasLimit: "21000",
      nonce: 0,
      to: "0x0000000000000000000000000000000000000002",
      type: 0,
      value: "0",
    });
  });

  it("maps borrow EVM payload decode failures to typed errors", async () => {
    const exit = await Effect.runPromiseExit(
      decodeBorrowEvmTransactionForWallet({
        action,
        transaction: {
          ...transaction,
          signablePayload: undefined,
        } as unknown as Transaction,
      })
    );
    const error = getExitError(exit);

    expect(error).toMatchObject({
      _tag: "BorrowPayloadDecodeError",
      actionId: "action-1",
      phase: "signing",
      transactionId: "tx-1",
    });
    expect(error).toBeInstanceOf(BorrowPayloadDecodeError);
  });

  it("preserves broadcasted wallet results as transaction hash submissions", () => {
    expect(
      getBorrowTransactionSubmitPayload({
        broadcasted: true,
        signedTx: transactionHash,
      })
    ).toEqual({ transactionHash });
  });

  it("preserves signed-only wallet results as signed payload submissions", () => {
    expect(
      getBorrowTransactionSubmitPayload({
        broadcasted: false,
        signedTx: "0xsigned-payload",
      })
    ).toEqual({ signedPayload: "0xsigned-payload" });
  });

  it("wraps the current SK wallet signer in an Effect wallet adapter", async () => {
    const signTransaction = vi.fn(
      (): ReturnType<SKWallet["signTransaction"]> =>
        EitherAsync.liftEither(
          Right({
            broadcasted: true,
            signedTx: transactionHash,
          })
        )
    );
    const adapter = makeSKWalletBorrowExecutionAdapter({
      getState: () => connectedWalletState,
      signTransaction: signTransaction as SKWallet["signTransaction"],
    });

    const result = await Effect.runPromise(
      adapter.signTransaction(makeSignRequest())
    );

    expect(result).toEqual({
      broadcasted: true,
      signedTx: transactionHash,
    });
    expect(signTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        ledgerHwAppId: null,
        network: "base",
        tx: "{}",
      })
    );
  });

  it("broadcasts borrow execution events to stream subscribers", async () => {
    const events = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* BorrowExecutionEventsService;
          const events: BorrowExecutionEvent[] = [];
          const fiber = yield* service.events.pipe(
            Stream.take(2),
            Stream.runForEach((event) =>
              Effect.sync(() => {
                events.push(event);
              })
            ),
            Effect.forkChild
          );

          yield* service.publish({
            _tag: "BorrowTransactionSubmitted",
            action,
            submissions: [],
            transaction: transaction as unknown as Transaction,
          });
          yield* service.publish({
            _tag: "BorrowActionCompleted",
            action,
            submissions: [],
          });
          yield* Fiber.join(fiber);

          return events;
        }).pipe(Effect.provide(BorrowExecutionEventsService.layer))
      )
    );

    expect(events.map((event) => event._tag)).toEqual([
      "BorrowTransactionSubmitted",
      "BorrowActionCompleted",
    ]);
  });

  it("fails with a typed wallet error when disconnected", async () => {
    const adapter = makeDisconnectedBorrowWalletExecutionAdapter();
    const exit = await Effect.runPromiseExit(
      adapter.signTransaction(makeSignRequest())
    );

    expect(getExitError(exit)).toBeInstanceOf(BorrowWalletDisconnectedError);
  });

  it("fails with a typed signing error when SK wallet signing fails", async () => {
    const adapter = makeSKWalletBorrowExecutionAdapter({
      getState: () => connectedWalletState,
      signTransaction: (() =>
        EitherAsync.liftEither(
          Left(new SendTransactionError())
        )) as SKWallet["signTransaction"],
    });
    const exit = await Effect.runPromiseExit(
      adapter.signTransaction(makeSignRequest())
    );

    expect(getExitError(exit)).toBeInstanceOf(BorrowSigningFailedError);
  });
});
