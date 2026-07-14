import { Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  type BorrowExecutionEvent,
  BorrowExecutionEventsService,
  borrowAtomRuntime,
} from "../../src/borrow";

const eventAtom = borrowAtomRuntime.atom(
  Stream.fromEffect(BorrowExecutionEventsService).pipe(
    Stream.flatMap((service) => service.events),
    Stream.map((event): BorrowExecutionEvent | null => event)
  ),
  { initialValue: null }
);

const publishEventAtom = borrowAtomRuntime.fn((event: BorrowExecutionEvent) =>
  BorrowExecutionEventsService.use((service) => service.publish(event))
);

describe("borrow runtime registry isolation", () => {
  it("does not publish execution events across atom registries", async () => {
    const firstRegistry = AtomRegistry.make();
    const secondRegistry = AtomRegistry.make();
    const unmountFirst = firstRegistry.mount(eventAtom);
    const unmountSecond = secondRegistry.mount(eventAtom);
    const event: BorrowExecutionEvent = {
      _tag: "BorrowActionCompleted",
      action: { id: "first-registry" } as never,
      submissions: [],
    };

    firstRegistry.set(publishEventAtom, event);

    await vi.waitFor(() => {
      const result = firstRegistry.get(eventAtom);
      expect(AsyncResult.isSuccess(result) && result.value).toBe(event);
    });

    const secondResult = secondRegistry.get(eventAtom);
    expect(
      AsyncResult.isSuccess(secondResult) && secondResult.value
    ).toBeNull();

    unmountSecond();
    unmountFirst();
    secondRegistry.dispose();
    firstRegistry.dispose();
  });
});
