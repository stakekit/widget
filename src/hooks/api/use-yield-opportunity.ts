import { YieldDto, yieldYieldOpportunity } from "@stakekit/api-hooks";
import { useSKWallet } from "../../providers/sk-wallet";
import { queryClient } from "../../services/query-client";
import { EitherAsync, Maybe } from "purify-ts";
import { useQuery } from "@tanstack/react-query";
import { withRequestErrorRetry } from "../../common/utils";

type Params = {
  yieldId: string;
  isLedgerLive: boolean;
  signal?: AbortSignal;
};

const staleTime = 1000 * 60 * 2;
const getKey = (params: Params) => [params.yieldId, params.isLedgerLive];

export const useYieldOpportunity = (integrationId: string | undefined) => {
  const { isLedgerLive } = useSKWallet();

  const yieldId = integrationId ?? "";

  return useQuery({
    queryKey: getKey({ yieldId, isLedgerLive }),
    enabled: !!integrationId,
    staleTime,
    queryFn: () => queryFn({ yieldId, isLedgerLive }),
  });
};

export const getYieldOpportunity = (params: Params) =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      queryKey: getKey(params),
      staleTime,
      queryFn: () => queryFn(params),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get yield opportunity");
  });

const queryFn = async (params: Params) =>
  (await fn(params)).caseOf({
    Left: (e) => Promise.reject(e),
    Right: (r) => Promise.resolve(r),
  });

const fn = ({ isLedgerLive, yieldId, signal }: Params) =>
  withRequestErrorRetry({
    fn: () =>
      yieldYieldOpportunity(
        yieldId,
        { ledgerWalletAPICompatible: isLedgerLive },
        signal
      ),
  }).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get yield opportunity");
  });

export const getYieldOpportunityFromCache = (params: Params) =>
  Maybe.fromNullable(
    queryClient.getQueryData<YieldDto | undefined>(getKey(params))
  );

export const setYieldOpportunityInCache = ({
  yieldDto,
  isLedgerLive,
}: {
  yieldDto: YieldDto;
  isLedgerLive: boolean;
}) => {
  queryClient.setQueryData(
    getKey({ isLedgerLive, yieldId: yieldDto.id }),
    yieldDto
  );
};
