import { test as base, describe, expect, vi } from "vitest";
import { worker } from "../mocks/worker";

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

export const it = test;

export { describe, expect, vi };
