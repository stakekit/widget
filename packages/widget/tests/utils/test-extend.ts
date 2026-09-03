import { test as base, describe, expect, vi } from "@effect/vitest";
import { worker } from "../mocks/worker";
import { makeFixtureMethods } from "./effect-test";

export type TestWorker = typeof worker;

let isWorkerStarted = false;

const test = base.extend<{ worker: typeof worker }>({
  worker: [
    // biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require object destructuring here.
    async ({}, use) => {
      if (!isWorkerStarted) {
        await worker.start({ quiet: true });
        isWorkerStarted = true;
      }

      await use(worker);

      worker.resetHandlers();
    },
    {
      auto: true,
    },
  ],
});

export const it = makeFixtureMethods(test);

export { describe, expect, vi };
