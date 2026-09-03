import { afterAll, test as base, describe, expect, vi } from "@effect/vitest";
import { server } from "../mocks/server";
import { makeFixtureMethods } from "./effect-test";

let isServerStarted = false;

const test = base.extend<{ worker: typeof server }>({
  worker: [
    // biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require object destructuring here.
    async ({}, use) => {
      if (!isServerStarted) {
        server.listen({ onUnhandledRequest: "error" });
        isServerStarted = true;
      }

      await use(server);

      server.resetHandlers();
    },
    {
      auto: true,
    },
  ],
});

afterAll(() => {
  if (isServerStarted) {
    server.close();
    isServerStarted = false;
  }
});

export const it = makeFixtureMethods(test);

export { describe, expect, vi };
