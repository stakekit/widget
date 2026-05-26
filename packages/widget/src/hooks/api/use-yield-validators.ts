import { useQuery } from "@tanstack/react-query";
import type { ValidatorDto } from "../../domain/types/validators";
import type { ValidatorsConfig } from "../../domain/types/yields";
import { filterValidators, type Yield } from "../../domain/types/yields";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useValidatorsConfig } from "../use-validators-config";

const PAGE_SIZE = 100;
const staleTime = 1000 * 60 * 2;

type Params = {
  yieldId: string;
  network?: Yield["token"]["network"];
  validatorsConfig: ValidatorsConfig;
  apiClient: ReturnType<typeof useApiClient>;
  signal?: AbortSignal;
};

const getYieldValidatorsQueryKey = ({ yieldId }: Pick<Params, "yieldId">) => [
  "yield-validators",
  yieldId,
];

const getYieldValidatorsQueryFn = async ({
  yieldId,
  network,
  validatorsConfig,
  apiClient,
  signal,
}: Params): Promise<ValidatorDto[]> => {
  const fetchPage = (offset: number) =>
    apiClient
      .withRunOptions({ signal })
      .yield.YieldsControllerGetYieldValidators(yieldId, {
        params: {
          offset,
          limit: PAGE_SIZE,
        },
      });

  const firstPage = await fetchPage(0);

  const remainingOffsets = Array.from(
    { length: Math.ceil(firstPage.total / PAGE_SIZE) - 1 },
    (_, index) => (index + 1) * PAGE_SIZE
  );

  const remainingPages = await Promise.all(
    remainingOffsets.map((offset) =>
      fetchPage(offset).catch(() => ({ items: [] }))
    )
  );

  const validators = [firstPage, ...remainingPages].flatMap(
    (page) => page.items ?? []
  );

  return network
    ? filterValidators({
        validatorsConfig,
        validators,
        network,
        yieldId,
      })
    : validators;
};

const getYieldValidatorsQueryOptions = (params: Params) => ({
  queryKey: getYieldValidatorsQueryKey(params),
  staleTime,
  queryFn: ({ signal }: { signal?: AbortSignal }) =>
    getYieldValidatorsQueryFn({ ...params, signal }),
});

export const useYieldValidators = ({
  enabled = true,
  yieldId,
  network,
}: {
  enabled?: boolean;
  yieldId?: string;
  network?: Yield["token"]["network"];
}) => {
  const apiClient = useApiClient();
  const validatorsConfig = useValidatorsConfig();

  return useQuery({
    ...getYieldValidatorsQueryOptions({
      yieldId: yieldId ?? "",
      network,
      validatorsConfig,
      apiClient,
    }),
    enabled: enabled && !!yieldId,
  });
};
