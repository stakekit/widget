import type { WalletList } from "@stakekit/rainbowkit";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import { config } from "../../config";
import type { InitParams } from "../../domain/types/init-params";
import { isLedgerDappBrowserProvider } from "../../utils";
import type { EnabledChainsMap } from "./ledger-connector";

const queryKey = [config.appPrefix, "ledger-live-config"];
const staleTime = Number.POSITIVE_INFINITY;

const queryFn = async ({
  enabledChainsMap,
  queryParams,
}: {
  enabledChainsMap: EnabledChainsMap;
  queryParams: InitParams;
}): Promise<{
  groupName: string;
  wallets: WalletList[number]["wallets"];
} | null> => {
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
