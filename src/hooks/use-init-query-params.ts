import { useYieldYieldOpportunityHook } from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe, Right } from "purify-ts";
import { isSupportedChain } from "../domain/types/chains";
import type { QueryParams } from "../domain/types/query-params";
import { getYieldOpportunity } from "../hooks/api/use-yield-opportunity";
import { useSKQueryClient } from "../providers/query-client";
import { useSKWallet } from "../providers/sk-wallet";
import { typeSafeObjectFromEntries } from "../utils";
import { MaybeWindow } from "../utils/maybe-window";

const queryKey = ["init-params"];
const staleTime = 0;
const cacheTime = 0;

export const useInitQueryParams = <T = QueryParams>(opts?: {
  select: (val: QueryParams) => T;
}) => {
  const { isLedgerLive } = useSKWallet();

  const queryClient = useSKQueryClient();

  const yieldYieldOpportunity = useYieldYieldOpportunityHook();

  return useQuery({
    queryKey,
    staleTime,
    gcTime: cacheTime,
    queryFn: () =>
      queryFn({ isLedgerLive, queryClient, yieldYieldOpportunity }),
    select: opts?.select,
  });
};

export const getInitialQueryParams = (
  params: Parameters<typeof fn>[0] & { queryClient: QueryClient }
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey,
      staleTime,
      gcTime: cacheTime,
      queryFn: () => queryFn(params),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get init query params");
  });

const queryFn = async (params: Parameters<typeof fn>[0]) =>
  (await fn(params)).unsafeCoerce();

const fn = ({
  isLedgerLive,
  queryClient,
  yieldYieldOpportunity,
}: {
  isLedgerLive: boolean;
  queryClient: QueryClient;
  yieldYieldOpportunity: ReturnType<typeof useYieldYieldOpportunityHook>;
}): EitherAsync<Error, QueryParams> =>
  EitherAsync.liftEither(
    MaybeWindow.map((w) => new URL(w.location.href))
      .map(
        (url) =>
          [
            ["network", url.searchParams.get("network")],
            ["token", url.searchParams.get("token")],
            ["yieldId", url.searchParams.get("yieldId")],
            ["validator", url.searchParams.get("validator")],
            ["pendingaction", url.searchParams.get("pendingaction")],
            ["referralCode", url.searchParams.get("ref")],
            ["accountId", url.searchParams.get("accountId")],
          ] as const
      )
      .map((val) =>
        typeSafeObjectFromEntries(
          val.map(([k, v]) => [
            k,
            k === "network"
              ? Maybe.fromNullable(v)
                  .chain((val) =>
                    val && isSupportedChain(val) ? Maybe.of(val) : Maybe.empty()
                  )
                  .extractNullable()
              : v ?? null,
          ])
        )
      )
      .toEither(new Error("missing window"))
  )
    .map((val) => ({
      ...val,
      accountId: val.accountId ? decodeURIComponent(val.accountId) : null,
    }))
    .chain<Error, QueryParams>((val) => {
      const yId = val.yieldId;

      if (yId && (!val.network || !val.token)) {
        return getYieldOpportunity({
          isLedgerLive,
          yieldId: yId,
          queryClient,
          yieldYieldOpportunity,
        }).map((yieldData) => ({
          ...val,
          network: yieldData.token.network,
          token: yieldData.token.symbol,
          yieldData,
        }));
      }

      return EitherAsync.liftEither(Right({ ...val, yieldData: null }));
    });
