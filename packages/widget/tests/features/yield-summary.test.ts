import { Cause, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { makeYieldSummary } from "../../src/features/yield-summary";
import { yieldApiYieldFixture } from "../fixtures";

describe("Yield Summary", () => {
  it("publishes semantic provider, reward-token, and yield-type facts", () => {
    const selectedYield = yieldApiYieldFixture();
    const inputAtom = Atom.make({
      selectedProviderYieldId: null,
      validators: new Map(),
      yield: selectedYield,
    });
    const summary = makeYieldSummary(inputAtom, {
      providerYieldsResultAtom: Atom.make(AsyncResult.success([])),
    });
    const registry = AtomRegistry.make();

    try {
      expect(registry.get(summary.viewAtom)).toMatchObject({
        error: null,
        providers: [
          {
            name: selectedYield.metadata.name,
          },
        ],
        rewardToken: null,
        status: "ready",
      });
      expect(registry.get(summary.viewAtom).yieldType).not.toBeNull();
    } finally {
      registry.dispose();
    }
  });

  it("normalizes an unavailable provider-yield resource", () => {
    const inputAtom = Atom.make({
      selectedProviderYieldId: null,
      validators: new Map(),
      yield: yieldApiYieldFixture(),
    });
    const failure = new Error("provider yields unavailable");
    const summary = makeYieldSummary(inputAtom, {
      providerYieldsResultAtom: Atom.make(AsyncResult.fail(failure)),
    });
    const registry = AtomRegistry.make();

    try {
      expect(registry.get(summary.viewAtom)).toMatchObject({
        error: {
          _tag: "YieldSummaryResourceError",
          cause: failure,
          retryable: true,
        },
        providers: null,
        status: "failed",
      });
    } finally {
      registry.dispose();
    }
  });

  it("retains usable projections while refreshing and after refresh failure", () => {
    const selectedYield = yieldApiYieldFixture();
    const inputAtom = Atom.make({
      selectedProviderYieldId: null,
      validators: new Map(),
      yield: selectedYield,
    });
    const previous = AsyncResult.success([]);
    const providerYieldsResultAtom =
      Atom.make<
        AsyncResult.AsyncResult<ReadonlyArray<typeof selectedYield>, Error>
      >(previous);
    const summary = makeYieldSummary(inputAtom, {
      providerYieldsResultAtom,
    });
    const registry = AtomRegistry.make();

    try {
      registry.set(providerYieldsResultAtom, AsyncResult.waiting(previous));
      expect(registry.get(summary.viewAtom)).toMatchObject({
        error: null,
        providers: [{ name: selectedYield.metadata.name }],
        status: "refreshing",
      });

      const failure = new Error("refresh failed");
      registry.set(
        providerYieldsResultAtom,
        AsyncResult.failure(Cause.fail(failure), {
          previousSuccess: Option.some(previous),
        })
      );
      expect(registry.get(summary.viewAtom)).toMatchObject({
        error: { cause: failure },
        providers: [{ name: selectedYield.metadata.name }],
        status: "ready",
      });
    } finally {
      registry.dispose();
    }
  });
});
