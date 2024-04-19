import type { YieldDto } from "@stakekit/api-hooks";
import { useYieldYieldOpportunityHook } from "@stakekit/api-hooks";
import { useSKWallet } from "../../providers/sk-wallet";
import { EitherAsync, Maybe } from "purify-ts";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { withRequestErrorRetry } from "../../common/utils";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  signal?: AbortSignal;
};

const staleTime = 1000 * 60 * 2;
const getKey = (params: Params) => [
  "yield-opportunity",
  params.yieldId,
  params.isLedgerLive,
];

export const useYieldOpportunity = (integrationId: string | undefined) => {
  const { isLedgerLive } = useSKWallet();

  const yieldId = integrationId ?? "";

  const yieldYieldOpportunity = useYieldYieldOpportunityHook();

  return useQuery({
    queryKey: getKey({ yieldId, isLedgerLive }),
    enabled: !!integrationId,
    staleTime,
    queryFn: () => queryFn({ yieldId, isLedgerLive, yieldYieldOpportunity }),
  });
};

export const getYieldOpportunity = (
  params: Params & {
    queryClient: QueryClient;
    yieldYieldOpportunity: ReturnType<typeof useYieldYieldOpportunityHook>;
  }
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getKey(params),
      staleTime,
      queryFn: () => queryFn(params),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get yield opportunity");
  });

const queryFn = async (
  params: Params & {
    yieldYieldOpportunity: ReturnType<typeof useYieldYieldOpportunityHook>;
  }
) => (await fn(params)).unsafeCoerce();

const fn = ({
  isLedgerLive,
  yieldId,
  yieldYieldOpportunity,
}: Params & {
  yieldYieldOpportunity: ReturnType<typeof useYieldYieldOpportunityHook>;
}) =>
  withRequestErrorRetry({
    fn: () =>
      yieldYieldOpportunity(yieldId, {
        ledgerWalletAPICompatible: isLedgerLive,
      }),
  }).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get yield opportunity");
  });

export const getYieldOpportunityFromCache = (
  params: Params & { queryClient: QueryClient }
) =>
  Maybe.fromNullable(
    params.queryClient.getQueryData<YieldDto | undefined>(getKey(params))
  );

export const setYieldOpportunityInCache = ({
  yieldDto,
  isLedgerLive,
  queryClient,
}: {
  yieldDto: YieldDto;
  isLedgerLive: boolean;
  queryClient: QueryClient;
}) => {
  queryClient.setQueryData(
    getKey({ isLedgerLive, yieldId: yieldDto.id }),
    yieldDto
  );
};
