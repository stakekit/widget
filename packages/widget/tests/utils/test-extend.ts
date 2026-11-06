import { test as base, describe, expect, vi } from "@effect/vitest";
import { NetworkReadyState } from "msw/experimental";

import { network } from "../mocks/network";
import { makeFixtureMethods } from "./effect-test";

export type TestWorker = typeof network;

const test = base.extend<{ worker: typeof network }>({
  worker: [
    // oxlint-disable-next-line eslint/no-empty-pattern -- Vitest fixtures require object destructuring here.
    async ({}, use) => {
      if (network.readyState === NetworkReadyState.DISABLED) {
        network.enable();
      }

      await use(network);

      network.resetHandlers();
    },
    {
      auto: true,
    },
  ],
});

export const it = makeFixtureMethods(test);

export { describe, expect, vi };
