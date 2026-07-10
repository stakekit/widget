import type { WalletList } from "@stakekit/rainbowkit";
import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import type { InitParams } from "../../domain/types/init-params";
import { isLedgerDappBrowserProvider } from "../../utils";
import type { EnabledChainsMap } from "./ledger-connector";

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

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  EitherAsync(() => queryFn(opts)).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get ledger live config");
  });
