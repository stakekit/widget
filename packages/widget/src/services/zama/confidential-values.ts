import {
  Context,
  Effect,
  Layer,
  PubSub,
  type Stream,
  SubscriptionRef,
} from "effect";
import type { ConfidentialValues as Values } from "../../domain/earn/confidential";

type ValueKey = Values extends ReadonlyMap<infer Key, bigint> ? Key : never;

type ConfidentialValuesApi = Readonly<{
  readonly add: (
    entries: ReadonlyArray<readonly [ValueKey, bigint]>
  ) => Effect.Effect<void>;
  readonly changes: Stream.Stream<Values>;
  readonly clear: Effect.Effect<void>;
  readonly current: Effect.Effect<Values>;
  readonly remove: (
    predicate: (key: ValueKey) => boolean
  ) => Effect.Effect<void>;
}>;

/** Revealed Zama cleartexts; in memory only. */
export class ConfidentialValues extends Context.Service<
  ConfidentialValues,
  ConfidentialValuesApi
>()("stakekit/widget/ConfidentialValues") {
  static readonly layer = Layer.effect(
    ConfidentialValues,
    Effect.gen(function* () {
      const ref = yield* SubscriptionRef.make<Values>(new Map());
      yield* Effect.addFinalizer(() => PubSub.shutdown(ref.pubsub));

      return {
        add: (entries) =>
          SubscriptionRef.update(
            ref,
            (current) => new Map([...current, ...entries])
          ),
        changes: SubscriptionRef.changes(ref),
        clear: SubscriptionRef.set(ref, new Map()),
        current: SubscriptionRef.get(ref),
        remove: (predicate) =>
          SubscriptionRef.update(
            ref,
            (current) =>
              new Map([...current].filter(([key]) => !predicate(key)))
          ),
      } satisfies ConfidentialValuesApi;
    })
  );
}
