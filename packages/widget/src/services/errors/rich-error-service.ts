import { Context, Effect, Layer, SubscriptionRef } from "effect";
import type { RichError } from "./rich-error";

type PresentableApiRequest = {
  readonly richError: RichError | null;
};

/** Runs the failed work again, such as refreshing the Resource that failed. */
export type RichErrorRetry = () => void;

export class RichErrorService extends Context.Service<RichErrorService>()(
  "stakekit/widget/RichErrorService",
  {
    make: Effect.gen(function* () {
      const current = yield* SubscriptionRef.make<RichError | null>(null);
      // How to run the presented failure's work again, when it can be.
      const retry = yield* SubscriptionRef.make<RichErrorRetry | null>(null);
      const presentedRequests = new WeakSet<PresentableApiRequest>();

      const present = (
        error: PresentableApiRequest,
        retryWith?: RichErrorRetry
      ) =>
        Effect.suspend(() => {
          if (!error.richError || presentedRequests.has(error)) {
            return Effect.void;
          }

          presentedRequests.add(error);
          return SubscriptionRef.set(retry, retryWith ?? null).pipe(
            Effect.andThen(SubscriptionRef.set(current, error.richError))
          );
        });

      return {
        current,
        retry,
        present,
        reset: SubscriptionRef.set(current, null),
      } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(RichErrorService, RichErrorService.make);
}
