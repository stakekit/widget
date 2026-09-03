import { expect, it } from "@effect/vitest";
import { Effect, Latch, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

it.effect("retains method-form dependencies added during a batch rebuild", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    const source = Atom.make(Option.none<string>());
    const gate = yield* Latch.make();
    const asyncAtom = Atom.make((get) =>
      Effect.gen(function* () {
        const value = get(source);
        if (Option.isNone(value)) {
          return yield* Effect.fail("SourceIsNone" as const);
        }
        yield* gate.await;
        return `computed-${value.value}`;
      })
    );
    const derived = Atom.make((context): unknown => {
      const value = context.get(source);
      if (Option.isNone(value)) return "empty";
      return context.get(asyncAtom);
    });
    const unmountDerived = registry.mount(derived);
    const unmountAsync = registry.mount(asyncAtom);

    try {
      Atom.batch(() => registry.set(source, Option.some("a")));
      yield* gate.open;
      yield* Effect.yieldNow;

      const result = registry.get(derived) as AsyncResult.AsyncResult<
        string,
        "SourceIsNone"
      >;
      const derivedNode = registry.getNodes().get(derived);
      const asyncNode = registry.getNodes().get(asyncAtom);

      expect(AsyncResult.isSuccess(result)).toBe(true);
      if (!AsyncResult.isSuccess(result)) return;
      expect(result.value).toBe("computed-a");
      expect(derivedNode).toBeDefined();
      expect(asyncNode).toBeDefined();
      if (!derivedNode || !asyncNode) return;
      expect(derivedNode.parents.has(asyncNode)).toBe(true);
      expect(asyncNode.children.has(derivedNode)).toBe(true);
    } finally {
      unmountDerived();
      unmountAsync();
      registry.dispose();
    }
  })
);

it("rebuilds an atom invalidated during its own batch rebuild", () => {
  const registry = AtomRegistry.make();
  const source = Atom.make(0);
  const enabled = Atom.make(false);
  const updateSource = Atom.make((get) => {
    get.set(source, 1);
  });
  const derived = Atom.make((get) => {
    const value = get(source);
    if (get(enabled)) {
      get(updateSource);
    }
    return value;
  });
  const unmount = registry.mount(derived);

  try {
    Atom.batch(() => registry.set(enabled, true));
    expect(registry.get(derived)).toBe(1);
  } finally {
    unmount();
    registry.dispose();
  }
});
