import { delay, HttpResponse, http } from "msw";
import type { PropsWithChildren } from "react";
import {
  getYieldValidatorQueryKey,
  useYieldValidators,
} from "../../src/hooks/api/use-yield-validators";
import { SKApiClientProvider } from "../../src/providers/api/api-client-provider";
import {
  SKQueryClientProvider,
  useSKQueryClient,
} from "../../src/providers/query-client";
import { SettingsContextProvider } from "../../src/providers/settings";
import type { SettingsContextType } from "../../src/providers/settings/types";
import {
  yieldApiValidatorFixture,
  yieldApiValidatorsFixture,
} from "../fixtures";
import { describe, expect, it } from "../utils/test-extend";
import { renderHook } from "../utils/test-utils";

const yieldApiUrl = "https://yield.example.com";

const createWrapper =
  (validatorsConfig?: SettingsContextType["validatorsConfig"]) =>
  ({ children }: PropsWithChildren) => (
    <SettingsContextProvider
      apiKey="test-key"
      baseUrl="https://api.example.com"
      yieldsApiUrl={yieldApiUrl}
      variant="default"
      validatorsConfig={validatorsConfig}
    >
      <SKApiClientProvider>
        <SKQueryClientProvider>{children}</SKQueryClientProvider>
      </SKApiClientProvider>
    </SettingsContextProvider>
  );

const Wrapper = createWrapper();

const ConfiguredWrapper = createWrapper({
  ethereum: {
    allowed: ["preferred-0", "allowed-200"],
  },
});

describe("validator loading", () => {
  it("loads preferred validators first and defers non-preferred pages", async ({
    worker,
  }) => {
    const calls: Array<{
      limit: string | null;
      offset: string | null;
      preferred: string | null;
    }> = [];
    const preferredValidators = yieldApiValidatorsFixture(
      Array.from({ length: 150 }, (_, index) => ({
        address: `preferred-${index}`,
        preferred: true,
      }))
    );
    const otherValidators = yieldApiValidatorsFixture([
      { address: "other-0", preferred: false },
    ]);

    worker.use(
      http.get(
        `${yieldApiUrl}/v1/yields/:yieldId/validators`,
        ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get("offset") ?? 0);
          const preferred = url.searchParams.get("preferred");

          calls.push({
            limit: url.searchParams.get("limit"),
            offset: url.searchParams.get("offset"),
            preferred,
          });

          if (preferred === "false") {
            return HttpResponse.json({
              items: otherValidators,
              total: 10000,
              offset,
              limit: 100,
            });
          }

          return HttpResponse.json({
            items: preferredValidators.slice(offset, offset + 100),
            total: preferredValidators.length,
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

    await expect.poll(() => result.current.data?.length).toBe(150);
    expect(result.current.hasNextPage).toBe(true);

    expect(calls).toContainEqual({
      limit: "100",
      offset: "0",
      preferred: "true",
    });
    expect(calls).toContainEqual({
      limit: "1",
      offset: "0",
      preferred: "false",
    });
    expect(calls).toContainEqual({
      limit: "100",
      offset: "100",
      preferred: "true",
    });
    expect(calls).toHaveLength(3);

    await result.current.fetchNextPage();

    await expect.poll(() => result.current.data?.length).toBe(151);

    expect(calls).toContainEqual({
      limit: "100",
      offset: "0",
      preferred: "false",
    });
  });

  it("hydrates the individual validator cache from loaded pages", async ({
    worker,
  }) => {
    const preferredValidator = yieldApiValidatorFixture({
      address: "preferred-0",
      preferred: true,
    });
    const otherValidator = yieldApiValidatorFixture({
      address: "other-0",
      preferred: false,
    });

    worker.use(
      http.get(
        `${yieldApiUrl}/v1/yields/:yieldId/validators`,
        ({ request }) => {
          const url = new URL(request.url);
          const preferred = url.searchParams.get("preferred");

          if (preferred === "false") {
            return HttpResponse.json({
              items: [otherValidator],
              total: 1,
              offset: 0,
              limit: Number(url.searchParams.get("limit") ?? 100),
            });
          }

          return HttpResponse.json({
            items: [preferredValidator],
            total: 1,
            offset: 0,
            limit: 100,
          });
        }
      )
    );

    const { result } = await renderHook(
      () => ({
        queryClient: useSKQueryClient(),
        validators: useYieldValidators({
          yieldId: "yield-1",
          network: "ethereum",
        }),
      }),
      { wrapper: Wrapper }
    );

    await expect.poll(() => result.current.validators.data?.length).toBe(1);

    expect(
      result.current.queryClient.getQueryData(
        getYieldValidatorQueryKey({
          yieldId: "yield-1",
          address: preferredValidator.address,
        })
      )
    ).toEqual(preferredValidator);
    expect(
      result.current.queryClient.getQueryData(
        getYieldValidatorQueryKey({
          yieldId: "yield-1",
          address: otherValidator.address,
        })
      )
    ).toEqual(otherValidator);
  });

  it("skips raw pages that are empty after validator config filtering", async ({
    worker,
  }) => {
    const calls: Array<{
      limit: string | null;
      offset: string | null;
      preferred: string | null;
    }> = [];
    const preferredValidators = yieldApiValidatorsFixture([
      { address: "preferred-0", preferred: true },
    ]);
    const blockedValidators = (offset: number) =>
      yieldApiValidatorsFixture(
        Array.from({ length: 100 }, (_, index) => ({
          address: `blocked-${offset + index}`,
          preferred: false,
        }))
      );
    const allowedValidators = yieldApiValidatorsFixture([
      { address: "allowed-200", preferred: false },
    ]);

    worker.use(
      http.get(
        `${yieldApiUrl}/v1/yields/:yieldId/validators`,
        ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get("offset") ?? 0);
          const preferred = url.searchParams.get("preferred");

          calls.push({
            limit: url.searchParams.get("limit"),
            offset: url.searchParams.get("offset"),
            preferred,
          });

          if (preferred === "true") {
            return HttpResponse.json({
              items: preferredValidators,
              total: preferredValidators.length,
              offset,
              limit: 100,
            });
          }

          return HttpResponse.json({
            items:
              offset === 200 ? allowedValidators : blockedValidators(offset),
            total: 201,
            offset,
            limit: Number(url.searchParams.get("limit") ?? 100),
          });
        }
      )
    );

    const { result } = await renderHook(
      () => useYieldValidators({ yieldId: "yield-1", network: "ethereum" }),
      { wrapper: ConfiguredWrapper }
    );

    await expect.poll(() => result.current.data?.length).toBe(1);
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await expect.poll(() => result.current.data?.length).toBe(2);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.data?.map((validator) => validator.address)).toEqual([
      "preferred-0",
      "allowed-200",
    ]);
    expect(calls).toContainEqual({
      limit: "100",
      offset: "100",
      preferred: "false",
    });
    expect(calls).toContainEqual({
      limit: "100",
      offset: "200",
      preferred: "false",
    });
  });

  it("does not expose a next page when there are no non-preferred validators", async ({
    worker,
  }) => {
    const calls: Array<{
      limit: string | null;
      preferred: string | null;
    }> = [];
    const preferredValidators = yieldApiValidatorsFixture([
      { address: "preferred-0", preferred: true },
    ]);

    worker.use(
      http.get(
        `${yieldApiUrl}/v1/yields/:yieldId/validators`,
        ({ request }) => {
          const url = new URL(request.url);
          const preferred = url.searchParams.get("preferred");

          calls.push({
            limit: url.searchParams.get("limit"),
            preferred,
          });

          if (preferred === "false") {
            return HttpResponse.json({
              items: [],
              total: 0,
              offset: 0,
              limit: Number(url.searchParams.get("limit") ?? 100),
            });
          }

          return HttpResponse.json({
            items: preferredValidators,
            total: preferredValidators.length,
            offset: 0,
            limit: 100,
          });
        }
      )
    );

    const { result } = await renderHook(
      () => useYieldValidators({ yieldId: "yield-1", network: "ethereum" }),
      { wrapper: Wrapper }
    );

    await expect.poll(() => result.current.data?.length).toBe(1);

    expect(result.current.hasNextPage).toBe(false);
    expect(calls).toContainEqual({ limit: "1", preferred: "false" });
  });

  it("searches validators on the server by name and address", async ({
    worker,
  }) => {
    const calls: Array<{ name: string | null; address: string | null }> = [];
    const searchedValidator = yieldApiValidatorFixture({
      address: "searched-address",
      name: "Searched Validator",
    });

    worker.use(
      http.get(
        `${yieldApiUrl}/v1/yields/:yieldId/validators`,
        ({ request }) => {
          const url = new URL(request.url);
          const name = url.searchParams.get("name");
          const address = url.searchParams.get("address");

          calls.push({ name, address });

          return HttpResponse.json({
            items: name || address ? [searchedValidator] : [],
            total: name || address ? 1 : 0,
            offset: Number(url.searchParams.get("offset") ?? 0),
            limit: 100,
          });
        }
      )
    );

    const { result } = await renderHook(
      () =>
        useYieldValidators({
          yieldId: "yield-1",
          network: "ethereum",
          search: "searched",
        }),
      { wrapper: Wrapper }
    );

    await expect.poll(() => result.current.data?.length).toBe(1);

    expect(calls).toContainEqual({ name: "searched", address: null });
    expect(calls).toContainEqual({ name: null, address: "searched" });
  });

  it("uses server totals to paginate deduplicated search results", async ({
    worker,
  }) => {
    const calls: Array<{
      offset: string | null;
      name: string | null;
      address: string | null;
    }> = [];
    const firstValidator = yieldApiValidatorFixture({
      address: "searched-address-0",
      name: "Searched Validator 0",
    });
    const secondValidator = yieldApiValidatorFixture({
      address: "searched-address-100",
      name: "Searched Validator 100",
    });

    worker.use(
      http.get(
        `${yieldApiUrl}/v1/yields/:yieldId/validators`,
        ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get("offset") ?? 0);
          const name = url.searchParams.get("name");
          const address = url.searchParams.get("address");

          calls.push({
            offset: url.searchParams.get("offset"),
            name,
            address,
          });

          if (name === "searched") {
            return HttpResponse.json({
              items: offset === 100 ? [secondValidator] : [firstValidator],
              total: 101,
              offset,
              limit: 100,
            });
          }

          return HttpResponse.json({
            items: [],
            total: 0,
            offset,
            limit: 100,
          });
        }
      )
    );

    const { result } = await renderHook(
      () =>
        useYieldValidators({
          yieldId: "yield-1",
          network: "ethereum",
          search: "searched",
        }),
      { wrapper: Wrapper }
    );

    await expect.poll(() => result.current.data?.length).toBe(1);
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await expect.poll(() => result.current.data?.length).toBe(2);
    expect(result.current.hasNextPage).toBe(false);
    expect(calls).toContainEqual({
      offset: "100",
      name: "searched",
      address: null,
    });
    expect(calls).toContainEqual({
      offset: "100",
      name: null,
      address: "searched",
    });
  });

  it("does not add independent search totals when checking for more pages", async ({
    worker,
  }) => {
    const nameValidator = yieldApiValidatorFixture({
      address: "searched-name-address",
      name: "Searched Name Validator",
    });
    const addressValidator = yieldApiValidatorFixture({
      address: "searched-address-address",
      name: "Searched Address Validator",
    });

    worker.use(
      http.get(
        `${yieldApiUrl}/v1/yields/:yieldId/validators`,
        ({ request }) => {
          const url = new URL(request.url);
          const name = url.searchParams.get("name");
          const address = url.searchParams.get("address");

          return HttpResponse.json({
            items: name ? [nameValidator] : address ? [addressValidator] : [],
            total: name || address ? 80 : 0,
            offset: Number(url.searchParams.get("offset") ?? 0),
            limit: 100,
          });
        }
      )
    );

    const { result } = await renderHook(
      () =>
        useYieldValidators({
          yieldId: "yield-1",
          network: "ethereum",
          search: "searched",
        }),
      { wrapper: Wrapper }
    );

    await expect.poll(() => result.current.data?.length).toBe(2);

    expect(result.current.hasNextPage).toBe(false);
  });

  it("keeps previous validators while a new search is loading", async ({
    worker,
  }) => {
    const defaultValidator = yieldApiValidatorFixture({
      address: "default-address",
      name: "Default Validator",
      preferred: true,
    });
    const searchedValidator = yieldApiValidatorFixture({
      address: "searched-address",
      name: "Searched Validator",
    });

    worker.use(
      http.get(
        `${yieldApiUrl}/v1/yields/:yieldId/validators`,
        async ({ request }) => {
          const url = new URL(request.url);
          const name = url.searchParams.get("name");
          const address = url.searchParams.get("address");
          const preferred = url.searchParams.get("preferred");

          await delay(50);

          if (name === "searched") {
            return HttpResponse.json({
              items: [searchedValidator],
              total: 1,
              offset: 0,
              limit: 100,
            });
          }

          if (address === "searched") {
            return HttpResponse.json({
              items: [],
              total: 0,
              offset: 0,
              limit: 100,
            });
          }

          if (preferred === "false") {
            return HttpResponse.json({
              items: [],
              total: 0,
              offset: 0,
              limit: Number(url.searchParams.get("limit") ?? 100),
            });
          }

          return HttpResponse.json({
            items: [defaultValidator],
            total: 1,
            offset: 0,
            limit: 100,
          });
        }
      )
    );

    const { result, rerender } = await renderHook(
      (props) =>
        useYieldValidators({
          yieldId: "yield-1",
          network: "ethereum",
          search: props?.search,
        }),
      {
        initialProps: { search: "" },
        wrapper: Wrapper,
      }
    );

    await expect
      .poll(() => result.current.data?.map((validator) => validator.address))
      .toEqual(["default-address"]);

    await rerender({ search: "searched" });

    expect(result.current.data?.map((validator) => validator.address)).toEqual([
      "default-address",
    ]);

    await expect
      .poll(() => result.current.data?.map((validator) => validator.address))
      .toEqual(["searched-address"]);
  });
});
