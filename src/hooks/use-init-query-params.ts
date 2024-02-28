import { QueryClient, useQuery } from "@tanstack/react-query";
import { useSKWallet } from "../providers/sk-wallet";
import { EitherAsync, Maybe, Right } from "purify-ts";
import { isSupportedChain } from "../domain/types/chains";
import { MaybeWindow } from "../utils/maybe-window";
import { typeSafeObjectFromEntries } from "../utils";
import { getYieldOpportunity } from "../hooks/api/use-yield-opportunity";
import { YieldDto } from "@stakekit/api-hooks";
import { useSKQueryClient } from "../providers/query-client";

const queryKey = ["init-params"];
const staleTime = 0;
const cacheTime = 0;

export const useInitQueryParams = <T = QueryParamsResult>(opts?: {
  select: (val: QueryParamsResult) => T;
}) => {
  const { isLedgerLive } = useSKWallet();

  const queryClient = useSKQueryClient();

  return useQuery({
    queryKey,
    staleTime,
    gcTime: cacheTime,
    queryFn: () => queryFn({ isLedgerLive, queryClient }),
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

export type QueryParamsResult = {
  network: string | null;
  token: string | null;
  yieldId: string | null;
  validator: string | null;
  pendingaction: string | null;
  yieldData: YieldDto | null;
  referralCode: string | null;
  accountId: string | null;
};

const fn = ({
  isLedgerLive,
  queryClient,
}: {
  isLedgerLive: boolean;
  queryClient: QueryClient;
}): EitherAsync<Error, QueryParamsResult> =>
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
  ).chain<Error, QueryParamsResult>((val) => {
    const yId = val.yieldId;

    if (yId && (!val.network || !val.token)) {
      return getYieldOpportunity({
        isLedgerLive,
        yieldId: yId,
        queryClient,
      }).map((yieldData) => ({
        ...val,
        network: yieldData.token.network,
        token: yieldData.token.symbol,
        yieldData,
      }));
    }

    return EitherAsync.liftEither(Right({ ...val, yieldData: null }));
  });
