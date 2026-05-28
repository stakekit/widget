import {
  keepPreviousData,
  type QueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import type { ValidatorDto } from "../../domain/types/validators";
import type { ValidatorsConfig } from "../../domain/types/yields";
import { filterValidators, type Yield } from "../../domain/types/yields";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSKQueryClient } from "../../providers/query-client";
import { useValidatorsConfig } from "../use-validators-config";

const PAGE_SIZE = 100;

type Params = {
  yieldId: string;
  network?: Yield["token"]["network"];
  search?: string;
  validatorsConfig: ValidatorsConfig;
  apiClient: ReturnType<typeof useApiClient>;
  queryClient: QueryClient;
  signal?: AbortSignal;
};

type PageParam =
  | { type: "preferred" }
  | { type: "other"; offset: number }
  | { type: "search"; offset: number; search: string };

type Page = {
  validators: ValidatorDto[];
  nextPageParam?: PageParam;
};

type RawValidatorsPage = {
  total: number;
  offset: number;
  items?: ReadonlyArray<ValidatorDto>;
};

export const getYieldValidatorQueryKey = ({
  yieldId,
  address,
}: {
  yieldId: Yield["id"];
  address: ValidatorDto["address"];
}) => ["yield-validator", yieldId, address] as const;

const setYieldValidatorsQueryData = ({
  queryClient,
  yieldId,
  validators,
}: {
  queryClient: QueryClient;
  yieldId: Yield["id"];
  validators: ReadonlyArray<ValidatorDto>;
}) => {
  validators.forEach((validator) => {
    queryClient.setQueryData(
      getYieldValidatorQueryKey({ yieldId, address: validator.address }),
      validator
    );
  });
};

export const getYieldValidatorsByAddresses = async ({
  apiClient,
  queryClient,
  yieldId,
  addresses,
}: {
  apiClient: ReturnType<typeof useApiClient>;
  queryClient: QueryClient;
  yieldId: Yield["id"];
  addresses: ReadonlyArray<ValidatorDto["address"]>;
}): Promise<ValidatorDto[]> => {
  const uniqueAddresses = [...new Set(addresses)];
  const validators = new Map(
    await Promise.all(
      uniqueAddresses.map(
        async (address): Promise<[ValidatorDto["address"], ValidatorDto]> => {
          try {
            const validator = await queryClient.fetchQuery({
              queryKey: getYieldValidatorQueryKey({ yieldId, address }),
              staleTime: Number.POSITIVE_INFINITY,
              queryFn: async ({ signal }) => {
                const validatorsPage = await apiClient
                  .withRunOptions({ signal })
                  .yield.YieldsControllerGetYieldValidators(yieldId, {
                    params: {
                      address,
                      limit: 100,
                      offset: 0,
                    },
                  });
                const lowerCaseAddress = address.toLowerCase();

                return (
                  validatorsPage.items?.find(
                    (validator) =>
                      validator.address.toLowerCase() === lowerCaseAddress
                  ) ?? null
                );
              },
            });

            return [address, validator ?? { address }];
          } catch {
            return [address, { address }];
          }
        }
      )
    )
  );

  return addresses.flatMap((address) => {
    const validator = validators.get(address);

    return validator ? [validator] : [];
  });
};

const getRawNextOffset = ({
  offset,
  total,
}: Pick<RawValidatorsPage, "offset" | "total">) => {
  const nextOffset = offset + PAGE_SIZE;

  return nextOffset < total ? nextOffset : undefined;
};

const getFilteredValidators = ({
  validators,
  network,
  validatorsConfig,
  yieldId,
}: Pick<Params, "network" | "validatorsConfig" | "yieldId"> & {
  validators: ValidatorDto[];
}) =>
  network
    ? filterValidators({
        validatorsConfig,
        validators,
        network,
        yieldId,
      })
    : validators;

const deduplicateValidatorsByAddress = (
  validators: ReadonlyArray<ValidatorDto>
) => {
  const seenAddresses = new Set<ValidatorDto["address"]>();

  return validators.filter((validator) => {
    const address = validator.address.toLowerCase();

    if (seenAddresses.has(address)) {
      return false;
    }

    seenAddresses.add(address);

    return true;
  });
};

const fetchPagedValidators = async ({
  yieldId,
  network,
  search,
  validatorsConfig,
  apiClient,
  queryClient,
  signal,
  pageParam,
}: Params & {
  pageParam: Exclude<PageParam, { type: "preferred" }>;
}): Promise<Page> => {
  const fetchPage = (params: {
    offset?: number;
    preferred?: boolean;
    name?: string;
    address?: string;
    limit?: number;
  }) =>
    apiClient
      .withRunOptions({ signal })
      .yield.YieldsControllerGetYieldValidators(yieldId, {
        params: {
          limit: params.limit ?? PAGE_SIZE,
          offset: params.offset ?? 0,
          preferred: params.preferred,
          name: params.name,
          address: params.address,
        },
      });

  let offset = pageParam.offset;

  while (true) {
    const rawPage: RawValidatorsPage = await (async () => {
      if (pageParam.type === "search" && search) {
        const [namePage, addressPage] = await Promise.all([
          fetchPage({ offset, name: search }),
          fetchPage({ offset, address: search }),
        ]);
        const items = deduplicateValidatorsByAddress([
          ...(namePage.items ?? []),
          ...(addressPage.items ?? []),
        ]);

        return {
          total: Math.max(namePage.total ?? 0, addressPage.total ?? 0),
          offset,
          items,
        };
      }

      return fetchPage({ offset, preferred: false });
    })();
    const rawValidators = [...(rawPage.items ?? [])];

    setYieldValidatorsQueryData({
      queryClient,
      yieldId,
      validators: rawValidators,
    });

    const validators = getFilteredValidators({
      validators: rawValidators,
      network,
      validatorsConfig,
      yieldId,
    });
    const nextOffset = getRawNextOffset(rawPage);

    if (validators.length || nextOffset === undefined) {
      return {
        validators,
        nextPageParam:
          nextOffset === undefined
            ? undefined
            : pageParam.type === "search"
              ? { type: "search", offset: nextOffset, search: pageParam.search }
              : { type: "other", offset: nextOffset },
      };
    }

    offset = nextOffset;
  }
};

const fetchValidatorsPage = async ({
  yieldId,
  network,
  search,
  validatorsConfig,
  apiClient,
  queryClient,
  signal,
  pageParam,
}: Params & { pageParam: PageParam }): Promise<Page> => {
  if (pageParam.type !== "preferred") {
    return fetchPagedValidators({
      yieldId,
      network,
      search,
      validatorsConfig,
      apiClient,
      queryClient,
      signal,
      pageParam,
    });
  }

  const fetchPage = (params: {
    offset?: number;
    preferred?: boolean;
    limit?: number;
  }) =>
    apiClient
      .withRunOptions({ signal })
      .yield.YieldsControllerGetYieldValidators(yieldId, {
        params: {
          limit: params.limit ?? PAGE_SIZE,
          offset: params.offset ?? 0,
          preferred: params.preferred,
        },
      });

  const [firstPage, otherPage] = await Promise.all([
    fetchPage({ preferred: true, offset: 0 }),
    fetchPage({ preferred: false, offset: 0, limit: 1 }),
  ]);
  const remainingOffsets = Array.from(
    { length: Math.max(0, Math.ceil(firstPage.total / PAGE_SIZE) - 1) },
    (_, index) => (index + 1) * PAGE_SIZE
  );
  const remainingPages = await Promise.all(
    remainingOffsets.map((offset) => fetchPage({ preferred: true, offset }))
  );
  const rawValidators = [firstPage, ...remainingPages].flatMap(
    (page) => page.items ?? []
  );

  setYieldValidatorsQueryData({
    queryClient,
    yieldId,
    validators: [...rawValidators, ...(otherPage.items ?? [])],
  });

  const validators = getFilteredValidators({
    validators: rawValidators,
    network,
    validatorsConfig,
    yieldId,
  });

  if (validators.length || otherPage.total === 0) {
    return {
      validators,
      nextPageParam:
        otherPage.total > 0 ? { type: "other", offset: 0 } : undefined,
    };
  }

  return fetchPagedValidators({
    yieldId,
    network,
    search,
    validatorsConfig,
    apiClient,
    queryClient,
    signal,
    pageParam: { type: "other", offset: 0 },
  });
};

const getInitialPageParam = (params: Params): PageParam => {
  if (params.search) {
    return { type: "search", offset: 0, search: params.search };
  }

  return { type: "preferred" };
};

const getYieldValidatorsQueryOptions = (params: Params) => ({
  queryKey: [
    "yield-validators",
    params.yieldId,
    params.search ?? "",
    params.validatorsConfig,
  ],
  staleTime: Number.POSITIVE_INFINITY,
  initialPageParam: getInitialPageParam(params),
  queryFn: ({
    signal,
    pageParam,
  }: {
    signal?: AbortSignal;
    pageParam: PageParam;
  }): Promise<Page> =>
    fetchValidatorsPage({
      ...params,
      signal,
      pageParam,
    }),
  getNextPageParam: (lastPage: Page) => lastPage.nextPageParam,
});

export const useYieldValidators = ({
  yieldId,
  network,
  search,
  enabled = true,
}: {
  enabled?: boolean;
  yieldId?: string;
  network?: Yield["token"]["network"];
  search?: string;
}) => {
  const apiClient = useApiClient();
  const queryClient = useSKQueryClient();
  const validatorsConfig = useValidatorsConfig();

  return useInfiniteQuery({
    ...getYieldValidatorsQueryOptions({
      apiClient,
      queryClient,
      validatorsConfig,
      yieldId: yieldId ?? "",
      network,
      search,
    }),
    enabled: enabled && !!yieldId,
    placeholderData: keepPreviousData,
    select: (data) => data.pages.flatMap((page) => page.validators),
  });
};
