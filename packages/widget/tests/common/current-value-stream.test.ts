import { Effect, Stream } from "effect";
import { describe, expect, it, vi } from "vitest";
import { makeCurrentValueStream } from "../../src/shared/effect/current-value-stream";

describe("current value stream", () => {
  it("seeds the current snapshot including updates made before subscription", async () => {
    const source = makeCurrentValueStream(0);
    source.set(1);

    const values = await Effect.runPromise(
      source.changes.pipe(Stream.take(1), Stream.runCollect)
    );

    expect(Array.from(values)).toEqual([1]);
  });

  it("publishes updates in order and finalizes the listener", async () => {
    const source = makeCurrentValueStream(0);
    const valuesPromise = Effect.runPromise(
      source.changes.pipe(Stream.take(3), Stream.runCollect)
    );

    await vi.waitFor(() => {
      expect(source.subscriberCount()).toBe(1);
    });
    source.set(1);
    source.set(2);

    expect(Array.from(await valuesPromise)).toEqual([0, 1, 2]);
    expect(source.subscriberCount()).toBe(0);
  });

  it("publishes independently to multiple consumers", async () => {
    const source = makeCurrentValueStream("initial");
    const first = Effect.runPromise(
      source.changes.pipe(Stream.take(2), Stream.runCollect)
    );
    const second = Effect.runPromise(
      source.changes.pipe(Stream.take(2), Stream.runCollect)
    );

    await vi.waitFor(() => {
      expect(source.subscriberCount()).toBe(2);
    });
    source.set("updated");

    expect(Array.from(await first)).toEqual(["initial", "updated"]);
    expect(Array.from(await second)).toEqual(["initial", "updated"]);
    expect(source.subscriberCount()).toBe(0);
  });
});
