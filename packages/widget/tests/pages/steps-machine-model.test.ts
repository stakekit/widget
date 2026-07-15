import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { ActionTransaction } from "../../src/domain/schema/action-models";
import { YieldId } from "../../src/domain/schema/identifiers";

import {
  getStepsMachineAction,
  initializeStepsMachine,
  StepsConfirmationError,
  type StepsMachineState,
  StepsSignError,
  StepsSubmissionError,
} from "../../src/services/workflow/steps-machine-model";
import { yieldApiTransactionFixture } from "../fixtures";

const yieldId = Schema.decodeSync(YieldId)("yield-1");

const transaction = (
  id: string,
  status: ActionTransaction["status"],
  stepIndex: number
) =>
  yieldApiTransactionFixture({
    id,
    network: "ethereum",
    status,
    stepIndex,
  });

describe("classic steps machine model", () => {
  it("sorts transactions and selects the first incomplete transaction", () => {
    const state = initializeStepsMachine({
      transactions: [
        transaction("third", "CREATED", 3),
        transaction("first", "CONFIRMED", 1),
        transaction("second", "SKIPPED", 2),
      ],
      yieldId,
    });

    expect(state._tag).toBe("Idle");
    expect(state.context.currentTxIndex).toBe(2);
    expect(state.context.txStates.map(({ tx }) => tx.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(state.context.txStates[0]?.meta.done).toBe(true);
    expect(state.context.txStates[1]?.meta.done).toBe(true);
  });

  it("preserves broadcasted recovery state without marking it complete", () => {
    const state = initializeStepsMachine({
      transactions: [transaction("broadcasted", "BROADCASTED", 0)],
      yieldId,
    });

    expect(state._tag).toBe("Idle");
    expect(state.context.txStates[0]?.meta).toMatchObject({
      broadcasted: true,
      done: false,
    });
  });

  it("disables empty and already-completed executions", () => {
    expect(initializeStepsMachine({ transactions: [], yieldId })._tag).toBe(
      "Disabled"
    );
    expect(
      initializeStepsMachine({
        transactions: [transaction("done", "CONFIRMED", 0)],
        yieldId,
      })._tag
    ).toBe("Disabled");
  });

  it("accepts only commands valid for the current phase", () => {
    const context = initializeStepsMachine({
      transactions: [transaction("tx", "CREATED", 0)],
      yieldId,
    }).context;
    const signError = new StepsSignError({
      customMessage: null,
      message: "sign failed",
      network: "ethereum",
      transactionId: "tx",
    });
    const submissionError = new StepsSubmissionError({
      broadcasted: false,
      message: "submit failed",
      transactionId: "tx",
    });
    const confirmationError = new StepsConfirmationError({
      message: "confirmation failed",
      network: "ethereum",
      transactionId: "tx",
    });
    const states: ReadonlyArray<
      readonly [StepsMachineState, string, string | null]
    > = [
      [{ _tag: "Idle", context }, "Start", "sign"],
      [{ _tag: "Signing", context }, "Start", null],
      [{ _tag: "SignFailed", context, error: signError }, "RetrySign", "sign"],
      [
        { _tag: "SubmissionFailed", context, error: submissionError },
        "RetrySubmission",
        "submit",
      ],
      [
        { _tag: "ConfirmationFailed", context, error: confirmationError },
        "RetryConfirmation",
        "confirm",
      ],
      [{ _tag: "Completed", context }, "RetryConfirmation", null],
    ];

    for (const [state, command, expected] of states) {
      expect(
        getStepsMachineAction({
          state,
          command: { _tag: command } as never,
        })
      ).toBe(expected);
    }
  });
});
