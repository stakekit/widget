import { Cause, Deferred, Effect, Exit, Fiber, Scope } from "effect";
import { describe, expect, it } from "vitest";
import { makeScopedSerialOperations } from "../../src/shared/effect/scoped-serial-operations";

const isInterrupted = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause);

describe("makeScopedSerialOperations", () => {
  it("runs operations serially", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const operations = yield* makeScopedSerialOperations();
          const firstStarted = yield* Deferred.make<void>();
          const releaseFirst = yield* Deferred.make<void>();
          const secondStarted = yield* Deferred.make<void>();
          const order: Array<string> = [];

          const first = yield* operations
            .run(
              Effect.gen(function* () {
                order.push("first-started");
                yield* Deferred.succeed(firstStarted, undefined);
                yield* Deferred.await(releaseFirst);
                order.push("first-completed");
                return "first";
              })
            )
            .pipe(Effect.forkChild);
          yield* Deferred.await(firstStarted);

          const second = yield* operations
            .run(
              Effect.gen(function* () {
                order.push("second-started");
                yield* Deferred.succeed(secondStarted, undefined);
                return "second";
              })
            )
            .pipe(Effect.forkChild);
          yield* Effect.yieldNow;
          const secondStartedBeforeRelease =
            yield* Deferred.isDone(secondStarted);

          yield* Deferred.succeed(releaseFirst, undefined);
          const values = yield* Effect.all([
            Fiber.join(first),
            Fiber.join(second),
          ]);
          return { order, secondStartedBeforeRelease, values };
        })
      )
    );

    expect(result).toEqual({
      order: ["first-started", "first-completed", "second-started"],
      secondStartedBeforeRelease: false,
      values: ["first", "second"],
    });
  });

  it("interrupts an in-flight operation when its owner Scope closes", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const ownerScope = yield* Scope.make();
          yield* Effect.addFinalizer(() => Scope.close(ownerScope, Exit.void));
          const operations = yield* makeScopedSerialOperations().pipe(
            Effect.provideService(Scope.Scope, ownerScope)
          );
          const started = yield* Deferred.make<void>();
          const operationInterrupted = yield* Deferred.make<void>();

          const caller = yield* operations
            .run(
              Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Effect.never),
                Effect.onInterrupt(() =>
                  Deferred.succeed(operationInterrupted, undefined).pipe(
                    Effect.asVoid
                  )
                )
              )
            )
            .pipe(Effect.forkChild);
          yield* Deferred.await(started);

          yield* Scope.close(ownerScope, Exit.void);
          const callerExit = yield* Fiber.await(caller);
          const interrupted = yield* Deferred.isDone(operationInterrupted);
          return { callerExit, interrupted };
        })
      )
    );

    expect(isInterrupted(result.callerExit)).toBe(true);
    expect(result.interrupted).toBe(true);
  });

  it("propagates caller interruption to the scoped operation", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const operations = yield* makeScopedSerialOperations();
          const started = yield* Deferred.make<void>();
          const operationInterrupted = yield* Deferred.make<void>();

          const caller = yield* operations
            .run(
              Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Effect.never),
                Effect.onInterrupt(() =>
                  Deferred.succeed(operationInterrupted, undefined).pipe(
                    Effect.asVoid
                  )
                )
              )
            )
            .pipe(Effect.forkChild);
          yield* Deferred.await(started);

          yield* Fiber.interrupt(caller);
          const callerExit = yield* Fiber.await(caller);
          const interrupted = yield* Deferred.isDone(operationInterrupted);
          const next = yield* operations.run(Effect.succeed("next"));
          return { callerExit, interrupted, next };
        })
      )
    );

    expect(isInterrupted(result.callerExit)).toBe(true);
    expect(result.interrupted).toBe(true);
    expect(result.next).toBe("next");
  });

  it("interrupts semaphore waiters and does not start operations after close", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const ownerScope = yield* Scope.make();
          yield* Effect.addFinalizer(() => Scope.close(ownerScope, Exit.void));
          const operations = yield* makeScopedSerialOperations().pipe(
            Effect.provideService(Scope.Scope, ownerScope)
          );
          const firstStarted = yield* Deferred.make<void>();
          const secondEntered = yield* Deferred.make<void>();

          const first = yield* operations
            .run(
              Deferred.succeed(firstStarted, undefined).pipe(
                Effect.andThen(Effect.never)
              )
            )
            .pipe(Effect.forkChild);
          yield* Deferred.await(firstStarted);
          const second = yield* operations
            .run(
              Deferred.succeed(secondEntered, undefined).pipe(
                Effect.as("second")
              )
            )
            .pipe(Effect.forkChild);
          yield* Effect.yieldNow;

          yield* Scope.close(ownerScope, Exit.void);
          const firstExit = yield* Fiber.await(first);
          const secondExit = yield* Fiber.await(second);
          const enteredBeforeClose = yield* Deferred.isDone(secondEntered);
          const afterClose = yield* operations
            .run(Effect.succeed("after-close"))
            .pipe(Effect.exit);
          return { afterClose, enteredBeforeClose, firstExit, secondExit };
        })
      )
    );

    expect(isInterrupted(result.firstExit)).toBe(true);
    expect(isInterrupted(result.secondExit)).toBe(true);
    expect(result.enteredBeforeClose).toBe(false);
    expect(isInterrupted(result.afterClose)).toBe(true);
  });
});
