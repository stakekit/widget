import { makeMethods, type Vitest } from "@effect/vitest";
import type * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import type { TestAPI, TestContext, TestOptions } from "vitest";

type WorkerFixtureContext<Worker> = { readonly worker: Worker };
type FixtureTestContext<Worker> = TestContext & WorkerFixtureContext<Worker>;

type FixtureEffectTest<Worker, R> = <A, E>(
  name: string,
  self: (context: FixtureTestContext<Worker>) => Effect.Effect<A, E, R>,
  timeout?: number | TestOptions
) => void;

interface FixtureEffectTester<Worker, R> extends FixtureEffectTest<Worker, R> {
  readonly each: Vitest.Tester<R>["each"];
  readonly fails: FixtureEffectTest<Worker, R>;
  readonly skip: FixtureEffectTest<Worker, R>;
  readonly skipIf: (condition: unknown) => FixtureEffectTest<Worker, R>;
  readonly runIf: (condition: unknown) => FixtureEffectTest<Worker, R>;
  readonly only: FixtureEffectTest<Worker, R>;
  readonly prop: Vitest.Tester<R>["prop"];
}

type FixtureMethods<Worker> = TestAPI<WorkerFixtureContext<Worker>> & {
  readonly effect: FixtureEffectTester<Worker, Scope.Scope>;
  readonly live: FixtureEffectTester<Worker, Scope.Scope>;
};

const fixtureContext =
  <Worker>(self: (context: FixtureTestContext<Worker>) => unknown) =>
  ({
    worker,
    task,
    signal,
    onTestFailed,
    onTestFinished,
    skip,
    annotate,
    expect,
    _local,
  }: FixtureTestContext<Worker>) =>
    self({
      worker,
      task,
      signal,
      onTestFailed,
      onTestFinished,
      skip,
      annotate,
      expect,
      _local,
    });

const fixtureContextLast =
  <Worker>(self: CallableFunction) =>
  (
    testCase: unknown,
    {
      worker,
      task,
      signal,
      onTestFailed,
      onTestFinished,
      skip,
      annotate,
      expect,
      _local,
    }: FixtureTestContext<Worker>
  ) =>
    Reflect.apply(self, undefined, [
      testCase,
      {
        worker,
        task,
        signal,
        onTestFailed,
        onTestFinished,
        skip,
        annotate,
        expect,
        _local,
      },
    ]);

const collectorModifiers = new Set(["only", "skip"]);
const collectorFactories = new Set(["runIf", "skipIf"]);

const withFixtureContext = <Worker, Collector extends CallableFunction>(
  collector: Collector,
  contextIsLastArgument = false
): Collector =>
  new Proxy(collector, {
    apply(target, thisArg, args) {
      const self = args[2];
      if (typeof self !== "function") {
        return Reflect.apply(target, thisArg, args);
      }
      return Reflect.apply(target, thisArg, [
        ...args.slice(0, 2),
        contextIsLastArgument
          ? fixtureContextLast<Worker>(self)
          : fixtureContext<Worker>(self),
      ]);
    },
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (
        collectorModifiers.has(String(property)) &&
        typeof value === "function"
      ) {
        return withFixtureContext<Worker, typeof value>(
          value,
          contextIsLastArgument
        );
      }
      if (property === "for" && typeof value === "function") {
        return (...args: ReadonlyArray<unknown>) =>
          withFixtureContext<Worker, CallableFunction>(
            Reflect.apply(value, receiver, args),
            true
          );
      }
      if (
        collectorFactories.has(String(property)) &&
        typeof value === "function"
      ) {
        return (...args: ReadonlyArray<unknown>) =>
          withFixtureContext<Worker, CallableFunction>(
            Reflect.apply(value, receiver, args),
            contextIsLastArgument
          );
      }
      return value;
    },
  });

export const makeFixtureMethods = <Worker>(
  test: TestAPI<WorkerFixtureContext<Worker>>
): FixtureMethods<Worker> => {
  const methods = makeMethods(withFixtureContext<Worker, typeof test>(test));
  const failureTest = new Proxy(test, {
    apply(_target, thisArg, args) {
      return Reflect.apply(test.fails, thisArg, args);
    },
  });
  const failureMethods = makeMethods(
    withFixtureContext<Worker, typeof failureTest>(failureTest)
  );
  const effect = new Proxy(methods.effect, {
    get(target, property, receiver) {
      if (property === "fails") {
        return failureMethods.effect;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const live = new Proxy(methods.live, {
    get(target, property, receiver) {
      if (property === "fails") {
        return failureMethods.live;
      }
      return Reflect.get(target, property, receiver);
    },
  });

  // @effect/vitest cannot express an extended TestAPI's fixture context, but
  // the collector proxy above passes the complete Vitest context at runtime.
  return new Proxy(test, {
    get(target, property, receiver) {
      if (property === "effect") {
        return effect;
      }
      if (property === "live") {
        return live;
      }
      return Reflect.get(target, property, receiver);
    },
  }) as unknown as FixtureMethods<Worker>;
};
