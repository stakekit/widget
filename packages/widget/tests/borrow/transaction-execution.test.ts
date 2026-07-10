import { Cause, Effect, Exit, Fiber, Option, Schema, Stream } from "effect";
import { EitherAsync, Left, Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";
import {
  Action,
  type BorrowExecutionEvent,
  BorrowExecutionEventsService,
  BorrowMarketsKey,
  BorrowPayloadDecodeError,
  BorrowPositionsKey,
  BorrowSigningFailedError,
  BorrowWalletDisconnectedError,
  type BorrowWalletSignRequest,
  borrowIntegrationsAtom,
  borrowMarketsAtom,
  borrowPositionsAtom,
  decodeBorrowEvmTransactionForWallet,
  getBorrowExecutionRefreshResources,
  getBorrowTransactionSubmitPayload,
  makeDisconnectedBorrowWalletExecutionAdapter,
  makeSKWalletBorrowExecutionAdapter,
  Transaction,
  WalletState,
} from "../../src/borrow";
import {
  TokenBalanceScanCommand,
  YieldBalancesCommand,
} from "../../src/domain/schema/financial-models";
import type { SKWallet } from "../../src/domain/types/wallet";
import {
  TokenBalancesKey,
  tokenBalancesAtom,
} from "../../src/hooks/api/token-balances-atoms";
import {
  YieldBalancesKey,
  yieldBalancesAtom,
} from "../../src/hooks/api/yield-balances-atoms";
import { SendTransactionError } from "../../src/providers/sk-wallet/errors";

const address = "0x0000000000000000000000000000000000000001";
const transactionHash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

const transactionInput = {
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

const transaction = Schema.decodeUnknownSync(Transaction)(transactionInput);

const action = Schema.decodeUnknownSync(Action)({
  address,
  action: "borrow",
  createdAt: "2026-07-10T12:00:00.000Z",
  currentStep: 1,
  hasNextStep: false,
  id: "action-1",
  integrationId: "morpho-blue",
  status: "CREATED",
  totalSteps: 1,
  transactions: [transactionInput],
});

const connectedWalletState = Schema.decodeUnknownSync(WalletState)({
  accounts: [{ address }],
  chains: [
    {
      chainId: "8453",
      iconUrl: "",
      name: "Base",
      network: "base",
    },
  ],
  currentAccount: { address },
  currentChain: {
    chainId: "8453",
    iconUrl: "",
    name: "Base",
    network: "base",
  },
  network: "base",
  status: "connected",
});

const makeSignRequest = (): BorrowWalletSignRequest => ({
  action,
  network: "base",
  transaction,
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
          transaction,
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
        },
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
            transaction,
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

  it("targets execution refresh to the affected address and network", () => {
    const event: BorrowExecutionEvent = {
      _tag: "BorrowTransactionSubmitted",
      action,
      submissions: [],
      transaction,
    };
    const resources = getBorrowExecutionRefreshResources(event);
    const tokenCommand = Schema.decodeUnknownSync(TokenBalanceScanCommand)({
      addresses: { address },
      network: "base",
    });
    const yieldCommand = Schema.decodeUnknownSync(YieldBalancesCommand)({
      queries: [{ address, network: "base" }],
    });
    const otherTokenCommand = Schema.decodeUnknownSync(TokenBalanceScanCommand)(
      {
        addresses: { address },
        network: "ethereum",
      }
    );

    expect(resources).toContain(borrowIntegrationsAtom);
    expect(resources).toContain(
      borrowMarketsAtom(new BorrowMarketsKey({ network: "base" }))
    );
    expect(resources).toContain(
      borrowPositionsAtom(new BorrowPositionsKey({ address, network: "base" }))
    );
    expect(resources).toContain(
      tokenBalancesAtom(
        new TokenBalancesKey({ command: tokenCommand, enabled: true })
      )
    );
    expect(resources).toContain(
      yieldBalancesAtom(
        new YieldBalancesKey({ command: yieldCommand, enabled: true })
      )
    );
    expect(resources).not.toContain(
      tokenBalancesAtom(
        new TokenBalancesKey({ command: otherTokenCommand, enabled: true })
      )
    );
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
