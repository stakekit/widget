import type { WalletList } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import type { InitParams } from "../../domain/types/init-params";
import { isLedgerDappBrowserProvider } from "../../utils";
import type { EnabledChainsMap } from "./ledger-connector";

const queryFn = ({
  enabledChainsMap,
  queryParams,
}: {
  enabledChainsMap: EnabledChainsMap;
  queryParams: InitParams;
}): Effect.Effect<
  {
    groupName: string;
    wallets: WalletList[number]["wallets"];
  } | null,
  Error
> => {
  if (!isLedgerDappBrowserProvider()) return Effect.succeed(null);

  return Effect.tryPromise({
    try: () => import("./ledger-connector"),
    catch: (error) =>
      new Error("Could not import ledger-connector", { cause: error }),
  }).pipe(
    Effect.map((module) =>
      module.ledgerLiveConnector({ enabledChainsMap, queryParams })
    )
  );
};

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  queryFn(opts).pipe(
    Effect.mapError(
      (error) => new Error("Could not get ledger live config", { cause: error })
    )
  );
