import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { makeStrictApiMutation } from "../../src/atoms/mutation";

const MutationResult = Schema.Struct({ id: Schema.String });

describe("shared mutation conventions", () => {
  it("executes once, strictly decodes, and invalidates only after success", () => {
    const runtime = Atom.runtime(Layer.empty);
    let attempts = 0;
    let dependentReads = 0;
    const dependent = Atom.make(() => {
      dependentReads += 1;
      return dependentReads;
    });
    const unrelated = Atom.make(0);
    const mutation = makeStrictApiMutation(runtime, {
      operation: "test-mutation",
      responseSchema: MutationResult,
      execute: (command: { readonly valid: boolean }) => {
        attempts += 1;
        return Effect.succeed(command.valid ? { id: "result-1" } : { id: 1 });
      },
      invalidates: () => [dependent],
    });
    const registry = AtomRegistry.make();

    expect(registry.get(dependent)).toBe(1);
    expect(registry.get(unrelated)).toBe(0);

    registry.set(mutation, { valid: false });
    const invalid = registry.get(mutation);
    expect(AsyncResult.isFailure(invalid)).toBe(true);
    expect(attempts).toBe(1);
    expect(registry.get(dependent)).toBe(1);

    registry.set(mutation, { valid: true });
    const valid = registry.get(mutation);
    expect(AsyncResult.isSuccess(valid)).toBe(true);
    if (AsyncResult.isSuccess(valid)) {
      expect(valid.value).toEqual({ id: "result-1" });
    }
    expect(attempts).toBe(2);
    expect(registry.get(dependent)).toBe(2);
    expect(registry.get(unrelated)).toBe(0);
  });

  it("does not automatically retry a failed non-idempotent request", () => {
    const runtime = Atom.runtime(Layer.empty);
    let attempts = 0;
    const mutation = makeStrictApiMutation(runtime, {
      operation: "failed-mutation",
      responseSchema: MutationResult,
      execute: () => {
        attempts += 1;
        return Effect.fail("transport-failed");
      },
    });
    const registry = AtomRegistry.make();

    registry.set(mutation, undefined);
    const result = registry.get(mutation);

    expect(AsyncResult.isFailure(result)).toBe(true);
    expect(attempts).toBe(1);
  });
});
