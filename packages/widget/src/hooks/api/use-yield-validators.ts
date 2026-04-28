import { useQuery } from "@tanstack/react-query";
import type { ValidatorDto } from "../../domain/types/validators";
import type { ValidatorsConfig } from "../../domain/types/yields";
import { filterValidators, type Yield } from "../../domain/types/yields";
import { useYieldApiFetchClient } from "../../providers/yield-api-client-provider";
import { getResponseData } from "../../providers/yield-api-client-provider/request-helpers";
import { useValidatorsConfig } from "../use-validators-config";

const PAGE_SIZE = 100;
const staleTime = 1000 * 60 * 2;

type Params = {
  yieldId: string;
  network?: Yield["token"]["network"];
  validatorsConfig: ValidatorsConfig;
  yieldApiFetchClient: ReturnType<typeof useYieldApiFetchClient>;
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
  yieldApiFetchClient,
  signal,
}: Params): Promise<ValidatorDto[]> => {
  const fetchPage = (offset: number) =>
    getResponseData(
      yieldApiFetchClient.GET("/v1/yields/{yieldId}/validators", {
        params: {
          path: {
            yieldId,
          },
          query: {
            offset,
            limit: PAGE_SIZE,
          },
        },
        signal,
      })
    );

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
  const yieldApiFetchClient = useYieldApiFetchClient();
  const validatorsConfig = useValidatorsConfig();

  return useQuery({
    ...getYieldValidatorsQueryOptions({
      yieldId: yieldId ?? "",
      network,
      validatorsConfig,
      yieldApiFetchClient,
    }),
    enabled: enabled && !!yieldId,
  });
};
