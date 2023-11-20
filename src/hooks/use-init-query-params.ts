import { useQuery } from "@tanstack/react-query";
import { useSKWallet } from "../providers/sk-wallet";
import { EitherAsync, Maybe, Right } from "purify-ts";
import { isSupportedChain } from "../domain/types/chains";
import { MaybeWindow } from "../utils/maybe-window";
import { typeSafeObjectFromEntries } from "../utils";
import { getYieldOpportunity } from "../hooks/api/use-yield-opportunity";
import { queryClient } from "../services/query-client";
import { YieldDto } from "@stakekit/api-hooks";

const queryKey = ["init-params"];
const staleTime = Infinity;

export const useInitQueryParams = () => {
  const { isLedgerLive } = useSKWallet();

  return useQuery({
    queryKey,
    staleTime,
    queryFn: () => queryFn({ isLedgerLive }),
  });
};

export const getInitialQueryParams = (...params: Parameters<typeof fn>) =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      queryKey,
      staleTime,
      queryFn: () => queryFn(...params),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get init query params");
  });

const queryFn = async (...params: Parameters<typeof fn>) =>
  (await fn(...params)).caseOf({
    Left(l) {
      console.log(l);
      return Promise.reject(l);
    },
    Right(r) {
      return Promise.resolve(r);
    },
  });

type Result = {
  network: string | null;
  token: string | null;
  yieldId: string | null;
  validator: string | null;
  pendingaction: string | null;
  yieldData: YieldDto | null;
};

const fn = ({
  isLedgerLive,
}: {
  isLedgerLive: boolean;
}): EitherAsync<Error, Result> =>
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
  ).chain<Error, Result>((val) => {
    const yId = val.yieldId;

    if (yId && (!val.network || !val.token)) {
      return getYieldOpportunity({ isLedgerLive, yieldId: yId }).map(
        (yieldData) => ({
          ...val,
          network: yieldData.token.network,
          token: yieldData.token.symbol,
          yieldData,
        })
      );
    }

    return EitherAsync.liftEither(Right({ ...val, yieldData: null }));
  });
