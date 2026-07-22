import { Array as EArray, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { delay, HttpResponse, http } from "msw";
import type { PropsWithChildren } from "react";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { YieldId } from "../../src/domain/schema/identifiers";
import { useYieldValidators } from "../../src/features/earn/react/use-yield-validators";
import { getPullResultItems } from "../../src/shared/effect/pagination";
import { yieldApiValidatorFixture } from "../fixtures";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { describe, expect, it } from "../utils/test-extend.dom";
import { renderHook } from "../utils/test-utils.dom";

const yieldApiUrl = "https://yield.example.com";

const Wrapper = ({ children }: PropsWithChildren) => (
  <TestAtomRuntimeProvider
    settings={normalizeWidgetConfig({
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
      variant: "default",
      yieldsApiUrl: yieldApiUrl,
    })}
  >
    {children}
  </TestAtomRuntimeProvider>
);

describe("validator loading", () => {
  it("loads one page per Pull, exposes waiting state, and omits malformed entries", async ({
    worker,
  }) => {
    let requestCount = 0;
    worker.use(
      http.get(
        `${yieldApiUrl}/v1/yields/:yieldId/validators`,
        async ({ request }) => {
          requestCount += 1;
          const offset = Number(
            new URL(request.url).searchParams.get("offset")
          );
          if (offset > 0) await delay(50);
          const valid = yieldApiValidatorFixture({
            address: `validator-${offset}`,
          });

          return HttpResponse.json({
            items:
              offset === 0 ? [valid, { ...valid, address: null }] : [valid],
            total: 101,
            offset,
            limit: 100,
          });
        }
      )
    );

    const hook = await renderHook(
      () =>
        useYieldValidators({
          yieldId: Schema.decodeSync(YieldId)("yield-1"),
          network: "ethereum",
        }),
      { wrapper: Wrapper }
    );
    const validators = () =>
      EArray.flatMap(
        getPullResultItems(hook.result.current.result),
        (page) => page.items
      );
    const hasNextPage = () =>
      hook.result.current.result.pipe(
        AsyncResult.value,
        Option.exists(({ done }) => !done)
      );

    await hook.act(async () => {
      await expect.poll(() => validators().length).toBe(1);
    });
    expect(hasNextPage()).toBe(true);
    expect(requestCount).toBe(1);

    await hook.act(async () => {
      hook.result.current.pull();
      await expect.poll(() => hook.result.current.result.waiting).toBe(true);
      await expect.poll(() => validators().length).toBe(2);
    });
    expect(requestCount).toBe(2);
    expect(hasNextPage()).toBe(false);
    expect(requestCount).toBe(2);
  });
});
