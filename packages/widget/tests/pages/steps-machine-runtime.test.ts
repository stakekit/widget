import {
  Deferred,
  Duration,
  Effect,
  Fiber,
  Option,
  Schema,
  Stream,
} from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it, vi } from "vitest";
import type { ActionTransaction } from "../../src/domain/schema/action-models";
import { YieldId } from "../../src/domain/schema/identifiers";

import type { ActionMeta } from "../../src/domain/types/wallets/generic-wallet";
import {
  WalletBroadcastError,
  WalletSigningError,
} from "../../src/services/wallet/wallet-service";
import {
  StepsMachineKey,
  type StepsMachineState,
} from "../../src/services/workflow/steps-machine-model";
import {
  makeStepsMachine,
  type StepsMachineHandle,
  type StepsMachineOperations,
} from "../../src/services/workflow/steps-machine-service";
import { yieldApiTransactionFixture } from "../fixtures";

const signedPayload = "signed-payload";
const transactionHash = "0xtransaction-hash";
const yieldId = Schema.decodeSync(YieldId)("yield-1");

const transaction = (
  id: string,
  overrides: Partial<ActionTransaction> = {}
): ActionTransaction =>
  yieldApiTransactionFixture({
    id,
    network: "ethereum",
    status: "CREATED",
    stepIndex: 0,
    unsignedTransaction: "unsigned-payload",
    ...overrides,
  });

const machineKey = (
  transactions: ReadonlyArray<ActionTransaction>,
  overrides: Partial<StepsMachineKey> = {}
) =>
  new StepsMachineKey({
    actionMeta: {} as ActionMeta,
    confirmationPollAttempts: 3,
    confirmationPollInterval: Duration.zero,
    transactions,
    yieldId,
    ...overrides,
  });

const makeAdapter = (
  overrides: Partial<StepsMachineOperations> = {}
): StepsMachineOperations => ({
  getStatus: () =>
    Effect.succeed({
      explorerUrl: "https://explorer.test/tx",
      status: "CONFIRMED",
    }),
  signMessage: () => Effect.succeed(signedPayload),
  signTransaction: () =>
    Effect.succeed({ broadcasted: false, signedTx: signedPayload }),
  submitHash: () => Effect.succeed(undefined),
  submitSigned: () => Effect.succeed(undefined),
  trackEvent: () => Effect.void,
  ...overrides,
});

const runToCompletion = (
  key: StepsMachineKey,
  adapter: StepsMachineOperations
) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const machine = yield* makeStepsMachine({ key, operations: adapter });
        const statesFiber = yield* machine.states.pipe(
          Stream.takeUntil((state) => state._tag === "Completed"),
          Stream.runCollect,
          Effect.forkChild
        );

        yield* Effect.yieldNow;
        yield* machine.dispatch({ _tag: "Start" });
        const states = yield* Fiber.join(statesFiber);
        const events = yield* machine.events.pipe(
          Stream.take(2),
          Stream.runCollect
        );

        return { events: Array.from(events), states: Array.from(states) };
      })
    )
  );

const waitForState = (
  machine: StepsMachineHandle,
  predicate: (state: StepsMachineState) => boolean
) =>
  machine.states.pipe(
    Stream.filter(predicate),
    Stream.runHead,
    Effect.forkChild
  );

describe("classic steps machine runtime", () => {
  it("completes signed-payload and broadcasted transaction paths", async () => {
    const submitSigned = vi.fn(() => Effect.succeed(undefined));
    const signed = await runToCompletion(
      machineKey([transaction("signed")]),
      makeAdapter({ submitSigned })
    );

    expect(signed.states.map((state) => state._tag)).toEqual([
      "Idle",
      "Signing",
      "Submitting",
      "Confirming",
      "Completed",
    ]);
    expect(submitSigned).toHaveBeenCalledWith({
      payload: { signedTransaction: signedPayload },
      transactionId: "signed",
    });
    expect(signed.events.map((event) => event._tag)).toEqual([
      "StepsSignSucceeded",
      "StepsCompleted",
    ]);

    const submitHash = vi.fn(() => Effect.succeed(undefined));
    await runToCompletion(
      machineKey([transaction("broadcast")]),
      makeAdapter({
        signTransaction: () =>
          Effect.succeed({ broadcasted: true, signedTx: transactionHash }),
        submitHash,
      })
    );

    expect(submitHash).toHaveBeenCalledWith({
      payload: { hash: transactionHash },
      transactionId: "broadcast",
    });
  });

  it("preserves typed wallet broadcast messages in signing failures", async () => {
    const customMessage = "Open your host wallet";
    const failedState = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeStepsMachine({
            key: machineKey([transaction("broadcast-failure")]),
            operations: makeAdapter({
              signTransaction: () =>
                Effect.fail(
                  new WalletBroadcastError({
                    cause: new Error("host rejected transaction"),
                    customMessage,
                  })
                ),
            }),
          });
          const failed = yield* waitForState(
            machine,
            (state) => state._tag === "SignFailed"
          );

          yield* machine.dispatch({ _tag: "Start" });
          return Option.getOrThrow(yield* Fiber.join(failed));
        })
      )
    );

    expect(failedState).toMatchObject({
      _tag: "SignFailed",
      error: {
        _tag: "StepsSignError",
        customMessage,
      },
    });
  });

  it("retries signing, submission, and confirmation only from matching failures", async () => {
    let signAttempts = 0;
    let submitAttempts = 0;
    let confirmationAttempts = 0;
    const adapter = makeAdapter({
      getStatus: () =>
        Effect.suspend(() => {
          confirmationAttempts += 1;
          return confirmationAttempts === 1
            ? Effect.fail(new Error("check failed"))
            : Effect.succeed({ explorerUrl: null, status: "CONFIRMED" });
        }),
      signTransaction: () =>
        Effect.suspend(() => {
          signAttempts += 1;
          return signAttempts === 1
            ? Effect.fail(
                new WalletSigningError({
                  cause: new Error("sign failed"),
                  operation: "transaction",
                })
              )
            : Effect.succeed({ broadcasted: false, signedTx: signedPayload });
        }),
      submitSigned: () =>
        Effect.suspend(() => {
          submitAttempts += 1;
          return submitAttempts === 1
            ? Effect.fail(new Error("submit failed"))
            : Effect.succeed(undefined);
        }),
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeStepsMachine({
            key: machineKey([transaction("retry")]),
            operations: adapter,
          });
          const signFailed = yield* waitForState(
            machine,
            (state) => state._tag === "SignFailed"
          );

          yield* machine.dispatch({ _tag: "Start" });
          yield* Fiber.join(signFailed);
          yield* machine.dispatch({ _tag: "RetrySubmission" });
          yield* Effect.yieldNow;
          expect(signAttempts).toBe(1);

          const submissionFailed = yield* waitForState(
            machine,
            (state) => state._tag === "SubmissionFailed"
          );
          yield* machine.dispatch({ _tag: "RetrySign" });
          yield* Fiber.join(submissionFailed);

          const confirmationFailed = yield* waitForState(
            machine,
            (state) => state._tag === "ConfirmationFailed"
          );
          yield* machine.dispatch({ _tag: "RetrySubmission" });
          yield* Fiber.join(confirmationFailed);

          const completed = yield* waitForState(
            machine,
            (state) => state._tag === "Completed"
          );
          yield* machine.dispatch({ _tag: "RetryConfirmation" });
          yield* Fiber.join(completed);
        })
      )
    );

    expect({ confirmationAttempts, signAttempts, submitAttempts }).toEqual({
      confirmationAttempts: 2,
      signAttempts: 2,
      submitAttempts: 2,
    });
  });

  it("suppresses duplicate commands and advances multiple transactions", async () => {
    const signTransaction = vi.fn(() =>
      Effect.succeed({ broadcasted: false, signedTx: signedPayload })
    );
    const adapter = makeAdapter({ signTransaction });

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeStepsMachine({
            key: machineKey([
              transaction("first", { stepIndex: 0 }),
              transaction("second", { stepIndex: 1 }),
            ]),
            operations: adapter,
          });
          const completed = yield* waitForState(
            machine,
            (state) => state._tag === "Completed"
          );

          yield* machine.dispatch({ _tag: "Start" });
          yield* machine.dispatch({ _tag: "Start" });
          const state = yield* Fiber.join(completed);

          return state;
        })
      )
    );

    expect(signTransaction).toHaveBeenCalledTimes(2);
    expect(
      Option.getOrThrow(result).context.txStates.every(({ meta }) => meta.done)
    ).toBe(true);
  });

  it("polls on the configured interval and exhausts the retry limit with TestClock", async () => {
    let checks = 0;
    const firstCheck = await Effect.runPromise(Deferred.make<void>());
    const adapter = makeAdapter({
      getStatus: () =>
        Effect.gen(function* () {
          checks += 1;
          if (checks === 1) yield* Deferred.succeed(firstCheck, undefined);

          return { explorerUrl: null, status: "PENDING" as const };
        }),
    });

    const failedState = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const machine = yield* makeStepsMachine({
            key: machineKey([transaction("pending")], {
              confirmationPollAttempts: 3,
              confirmationPollInterval: Duration.seconds(1),
            }),
            operations: adapter,
          });
          const failed = yield* waitForState(
            machine,
            (state) => state._tag === "ConfirmationFailed"
          );

          yield* machine.dispatch({ _tag: "Start" });
          yield* Deferred.await(firstCheck);
          expect(checks).toBe(1);
          yield* TestClock.adjust("999 millis");
          expect(checks).toBe(1);
          yield* TestClock.adjust("1 millis");
          expect(checks).toBe(2);
          yield* TestClock.adjust("1 second");

          return yield* Fiber.join(failed);
        }).pipe(Effect.provide(TestClock.layer()))
      )
    );

    expect(checks).toBe(3);
    expect(Option.getOrThrow(failedState)._tag).toBe("ConfirmationFailed");
  });

  it("interrupts scheduled polling when the machine scope closes", async () => {
    let checks = 0;
    const firstCheck = await Effect.runPromise(Deferred.make<void>());
    const adapter = makeAdapter({
      getStatus: () =>
        Effect.gen(function* () {
          checks += 1;
          yield* Deferred.succeed(firstCheck, undefined);
          return { explorerUrl: null, status: "PENDING" as const };
        }),
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.scoped(
          Effect.gen(function* () {
            const machine = yield* makeStepsMachine({
              key: machineKey([transaction("interrupt")], {
                confirmationPollAttempts: 20,
                confirmationPollInterval: Duration.seconds(1),
              }),
              operations: adapter,
            });

            yield* machine.dispatch({ _tag: "Start" });
            yield* Deferred.await(firstCheck);
          })
        );

        yield* TestClock.adjust("1 minute");
        yield* Effect.yieldNow;
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(checks).toBe(1);
  });
});
