import { Effect, Queue, Stream } from "effect";

const streamBufferSize = 16;

type CurrentValueStream<A> = {
  readonly changes: Stream.Stream<A>;
  readonly get: () => A;
  readonly set: (value: A) => void;
  /** Internal lifecycle diagnostic used by focused source and connector tests. */
  readonly subscriberCount: () => number;
};

export const makeCurrentValueStream = <A>(
  initialValue: A
): CurrentValueStream<A> => {
  let currentValue = initialValue;
  const subscribers = new Set<(value: A) => void>();

  const changes = Stream.callback<A>(
    (queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const publish = (value: A) => {
            Queue.offerUnsafe(queue, value);
          };

          subscribers.add(publish);
          publish(currentValue);
          return publish;
        }),
        (publish) =>
          Effect.sync(() => {
            subscribers.delete(publish);
          })
      ),
    { bufferSize: streamBufferSize, strategy: "sliding" }
  );

  return {
    changes,
    get: () => currentValue,
    set: (value) => {
      currentValue = value;
      for (const publish of subscribers) publish(value);
    },
    subscriberCount: () => subscribers.size,
  };
};
