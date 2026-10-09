import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Exit, Fiber, Option } from "effect";
import { WalletModal } from "../../src/services/wallet/wallet-modal";

describe("WalletModal", () => {
  it.effect("owns connect and chain open state", () =>
    Effect.gen(function* () {
      const modal = yield* WalletModal;

      expect(yield* modal.connectOpen.current).toBe(false);
      expect(yield* modal.chainOpen.current).toBe(false);

      yield* modal.openConnect;
      expect(yield* modal.connectOpen.current).toBe(true);

      yield* modal.chainOpen.set(true);
      expect(yield* modal.chainOpen.current).toBe(true);

      yield* modal.closeChain;
      expect(yield* modal.chainOpen.current).toBe(false);

      yield* modal.connectOpen.set(false);
      expect(yield* modal.connectOpen.current).toBe(false);
    }).pipe(Effect.provide(WalletModal.layer))
  );

  it.effect("keeps the picker opening during native presentation", () =>
    Effect.gen(function* () {
      const modal = yield* WalletModal;
      yield* modal.openConnect;
      const opening = yield* modal.connectOpen.opening;
      const work = yield* opening
        .run(Effect.never)
        .pipe(Effect.forkChild({ startImmediately: true }));
      yield* modal.presentationOpen.set(true);
      yield* modal.presentationOpen.set(false);
      yield* Effect.yieldNow;
      expect(yield* modal.connectOpen.current).toBe(true);
      expect(work.pollUnsafe()).toBeUndefined();
      yield* Fiber.interrupt(work);
    }).pipe(Effect.provide(WalletModal.layer))
  );

  it.effect("ends an opening on every set, interrupting its work", () =>
    Effect.gen(function* () {
      const modal = yield* WalletModal;
      yield* modal.openConnect;
      const opening = yield* modal.connectOpen.opening;
      const ended = yield* Deferred.make<void>();
      yield* opening.onEnd(Deferred.succeed(ended, undefined));
      const started = yield* Deferred.make<void>();
      const continued = { value: false };
      const work = yield* opening
        .run(
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.andThen(
              Effect.sync(() => {
                continued.value = true;
              })
            )
          )
        )
        .pipe(Effect.forkChild({ startImmediately: true }));
      yield* Deferred.await(started);

      // Reopening an open picker still starts a new opening.
      yield* modal.openConnect;
      expect(Option.isSome(yield* Deferred.poll(ended))).toBe(true);
      expect(Exit.hasInterrupts(yield* Fiber.await(work))).toBe(true);
      expect(continued.value).toBe(false);

      const late = { started: false };
      const lateExit = yield* opening
        .run(
          Effect.sync(() => {
            late.started = true;
          })
        )
        .pipe(Effect.exit);
      expect(Exit.hasInterrupts(lateExit)).toBe(true);
      expect(late.started).toBe(false);

      const next = yield* modal.connectOpen.opening;
      expect(yield* next.run(Effect.succeed("current"))).toBe("current");
    }).pipe(Effect.provide(WalletModal.layer))
  );

  it.effect("lets work that ends its own opening finish", () =>
    Effect.gen(function* () {
      const modal = yield* WalletModal;
      yield* modal.openConnect;
      const opening = yield* modal.connectOpen.opening;
      const result = yield* opening.run(
        modal.connectOpen
          .set(false)
          .pipe(Effect.andThen(Effect.yieldNow), Effect.as("finished"))
      );
      expect(result).toBe("finished");
      expect(yield* modal.connectOpen.current).toBe(false);
    }).pipe(Effect.provide(WalletModal.layer))
  );
});
