import {
  Cause,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  Schema,
  Stream,
} from "effect";
import { base, mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  Action,
  type BorrowExecutionEvent,
  BorrowExecutionEventsService,
  BorrowMarketsKey,
  BorrowPayloadDecodeError,
  BorrowPositionsKey,
  BorrowSigningFailedError,
  BorrowWalletDisconnectedError,
  BorrowWalletExecutionService,
  type BorrowWalletSignRequest,
  BorrowWalletStateChangedError,
  borrowIntegrationsAtom,
  borrowMarketsAtom,
  borrowPositionsAtom,
  decodeBorrowEvmTransactionForWallet,
  getBorrowExecutionRefreshResources,
  getBorrowTransactionSubmitPayload,
  Transaction,
} from "../../src/features/borrow/core";
import {
  tokenBalancesScanResourceAtom,
  yieldBalancesScanResourceAtom,
} from "../../src/features/portfolio";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../src/features/wallet/state/wallet";
import {
  WalletService,
  WalletSigningError,
} from "../../src/services/wallet/wallet-service";
import type { WalletOperations } from "../utils/wallet-operations";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
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

const connectedWalletState = {
  additionalAddresses: null,
  address,
  chain: base,
  connector: { id: "test", uid: "test" } as Connector,
  connectorChains: [base, mainnet],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "base",
  status: "connected",
} satisfies NormalizedWalletState;

const makeWalletService = ({
  state = connectedWalletState,
  signTransaction = () =>
    Effect.succeed({
      broadcasted: true as const,
      signedTx: transactionHash,
    }),
}: {
  readonly state?: NormalizedWalletState;
  readonly signTransaction?: WalletOperations["signTransaction"];
} = {}) =>
  ({
    getState: () => state,
    signTransaction,
  }) as unknown as WalletOperations;

const makeSignRequest = (): BorrowWalletSignRequest => ({
  action,
  network: "base",
  transaction,
  tx: "{}",
  txMeta: {} as never,
});

const signWithWallet = (
  wallet: WalletOperations,
  request: BorrowWalletSignRequest
) =>
  BorrowWalletExecutionService.use((service) =>
    service.signTransaction(request)
  ).pipe(
    Effect.provide(
      BorrowWalletExecutionService.layer.pipe(
        Layer.provide(
          Layer.succeed(WalletService, wallet as WalletService["Service"])
        )
      )
    )
  );

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

  it("wraps the shared wallet service with borrow validation", async () => {
    const signTransaction = vi.fn(() =>
      Effect.succeed({
        broadcasted: true as const,
        signedTx: transactionHash,
      })
    );
    const result = await Effect.runPromise(
      signWithWallet(makeWalletService({ signTransaction }), makeSignRequest())
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
    const resources = getBorrowExecutionRefreshResources(
      event,
      connectedWalletState
    );

    expect(resources).toContain(borrowIntegrationsAtom);
    expect(resources).toContain(
      borrowMarketsAtom(new BorrowMarketsKey({ network: "base" }))
    );
    expect(resources).toContain(
      borrowPositionsAtom(new BorrowPositionsKey({ address, network: "base" }))
    );
    expect(resources).toContain(tokenBalancesScanResourceAtom);
    expect(resources).toContain(yieldBalancesScanResourceAtom);

    const otherWalletResources = getBorrowExecutionRefreshResources(event, {
      ...connectedWalletState,
      network: "ethereum",
    });

    expect(otherWalletResources).not.toContain(tokenBalancesScanResourceAtom);
    expect(otherWalletResources).not.toContain(yieldBalancesScanResourceAtom);
  });

  it("fails with a typed wallet error when disconnected", async () => {
    const signTransaction = vi.fn(() => Effect.never);
    const wallet = makeWalletService({
      signTransaction,
      state: disconnectedNormalizedWalletState,
    });
    const exit = await Effect.runPromiseExit(
      signWithWallet(wallet, makeSignRequest())
    );

    expect(getExitError(exit)).toBeInstanceOf(BorrowWalletDisconnectedError);
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("fails when the account changes during execution", async () => {
    const wallet = makeWalletService({
      state: {
        ...connectedWalletState,
        address: Schema.decodeSync(WalletAddress)(
          "0x0000000000000000000000000000000000000002"
        ),
      },
    });
    const exit = await Effect.runPromiseExit(
      signWithWallet(wallet, makeSignRequest())
    );

    expect(getExitError(exit)).toBeInstanceOf(BorrowWalletStateChangedError);
  });

  it("fails when the network changes during execution", async () => {
    const wallet = makeWalletService({
      state: {
        ...connectedWalletState,
        chain: mainnet,
        network: "ethereum",
      },
    });
    const exit = await Effect.runPromiseExit(
      signWithWallet(wallet, makeSignRequest())
    );

    expect(getExitError(exit)).toBeInstanceOf(BorrowWalletStateChangedError);
  });

  it("maps shared wallet failures to typed borrow signing errors", async () => {
    const wallet = makeWalletService({
      signTransaction: () =>
        Effect.fail(
          new WalletSigningError({
            cause: new Error("rejected"),
            operation: "transaction",
          })
        ),
    });
    const exit = await Effect.runPromiseExit(
      signWithWallet(wallet, makeSignRequest())
    );

    expect(getExitError(exit)).toBeInstanceOf(BorrowSigningFailedError);
  });
});
