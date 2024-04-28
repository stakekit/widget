import { config } from "../../config";
import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import type { QueryClient } from "@tanstack/react-query";
import type { EnabledChainsMap } from "./ledger-connector";
import { isLedgerDappBrowserProvider } from "../../utils";
import type { QueryParams } from "../../domain/types/query-params";

const queryKey = [config.appPrefix, "ledger-live-config"];
const staleTime = Infinity;

const queryFn = async ({
  enabledChainsMap,
  queryParams,
}: {
  enabledChainsMap: EnabledChainsMap;
  queryParams: QueryParams;
}) => {
  return EitherAsync.liftEither(
    Maybe.fromFalsy(isLedgerDappBrowserProvider()).toEither(null)
  )
    .chain(() =>
      EitherAsync(() => import("./ledger-connector"))
        .mapLeft(() => new Error("Could not import ledger-connector"))
        .map((v) => v.ledgerLiveConnector({ enabledChainsMap, queryParams }))
    )
    .chainLeft((e) => EitherAsync.liftEither(e ? Left(e) : Right(null)))
    .caseOf({
      Right: (val) => Promise.resolve(val),
      Left: (l) => Promise.reject(l),
    });
};

export const getConfig = (
  opts: Parameters<typeof queryFn>[0] & { queryClient: QueryClient }
) =>
  EitherAsync(() =>
    opts.queryClient.fetchQuery({
      staleTime,
      queryKey,
      queryFn: () => queryFn(opts),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get ledger live config");
  });
