import { HttpResponse, http } from "msw";
import type { PropsWithChildren } from "react";
import { useYieldValidators } from "../../src/hooks/api/use-yield-validators";
import { SKAtomRuntimeProvider } from "../../src/providers/effect-atom-runtime";
import { SettingsContextProvider } from "../../src/providers/settings";
import { yieldApiValidatorFixture } from "../fixtures";
import { describe, expect, it } from "../utils/test-extend";
import { renderHook } from "../utils/test-utils";

const yieldApiUrl = "https://yield.example.com";

const Wrapper = ({ children }: PropsWithChildren) => (
  <SettingsContextProvider
    apiKey="test-key"
    baseUrl="https://api.example.com"
    yieldsApiUrl={yieldApiUrl}
    variant="default"
  >
    <SKAtomRuntimeProvider>{children}</SKAtomRuntimeProvider>
  </SettingsContextProvider>
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

    const { result } = await renderHook(
      () => useYieldValidators({ yieldId: "yield-1", network: "ethereum" }),
      { wrapper: Wrapper }
    );

    await expect.poll(() => result.current.data.length).toBe(1);
    expect(result.current.hasNextPage).toBe(true);

    result.current.fetchNextPage();

    await expect.poll(() => result.current.data.length).toBe(2);
    await expect.poll(() => result.current.hasNextPage).toBe(false);
  });
});
