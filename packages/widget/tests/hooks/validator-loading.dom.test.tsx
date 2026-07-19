import { Schema } from "effect";
import { HttpResponse, http } from "msw";
import type { PropsWithChildren } from "react";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { YieldId } from "../../src/domain/schema/identifiers";
import { useYieldValidators } from "../../src/features/earn/react/use-yield-validators";
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
  it("pulls validators with raw pagination and omits malformed entries", async ({
    worker,
  }) => {
    worker.use(
      http.get(
        `${yieldApiUrl}/v1/yields/:yieldId/validators`,
        ({ request }) => {
          const offset = Number(
            new URL(request.url).searchParams.get("offset")
          );
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

    await hook.act(async () => {
      await expect.poll(() => hook.result.current.data.length).toBe(1);
    });
    expect(hook.result.current.hasNextPage).toBe(true);

    await hook.act(async () => {
      hook.result.current.fetchNextPage();
      await expect.poll(() => hook.result.current.data.length).toBe(2);
      await expect.poll(() => hook.result.current.hasNextPage).toBe(false);
    });
  });
});
