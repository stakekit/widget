import { Context, Effect, Layer, SubscriptionRef } from "effect";
import type { RichError } from "./rich-error";

type PresentableApiRequest = {
  readonly richError: RichError | null;
};

export class RichErrorService extends Context.Service<RichErrorService>()(
  "stakekit/widget/RichErrorService",
  {
    make: Effect.gen(function* () {
      const current = yield* SubscriptionRef.make<RichError | null>(null);
      const presentedRequests = new WeakSet<PresentableApiRequest>();

      const present = (error: PresentableApiRequest) =>
        Effect.suspend(() => {
          if (!error.richError || presentedRequests.has(error)) {
            return Effect.void;
          }

          presentedRequests.add(error);
          return SubscriptionRef.set(current, error.richError);
        });

      return {
        current,
        present,
        reset: SubscriptionRef.set(current, null),
      } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(RichErrorService, RichErrorService.make);
}
