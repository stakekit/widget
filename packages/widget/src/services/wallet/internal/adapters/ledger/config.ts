import type { WalletList } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import type { InitParams } from "../../../../../services/wallet/init-params";
import { WalletIntegrationError } from "../../../wallet-errors";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import type { EnabledChainsMap } from "./ledger-connector";

const queryFn = ({
  enabledChainsMap,
  isLedgerDappBrowser,
  queryParams,
  runWalletEffect,
}: {
  enabledChainsMap: EnabledChainsMap;
  isLedgerDappBrowser: boolean;
  queryParams: InitParams;
  runWalletEffect: RunWalletEffect;
}): Effect.Effect<
  {
    groupName: string;
    wallets: WalletList[number]["wallets"];
  } | null,
  WalletIntegrationError
> => {
  if (!isLedgerDappBrowser) return Effect.succeed(null);

  return Effect.tryPromise({
    try: () => import("./ledger-connector"),
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "Could not import ledger-connector",
        operation: "ledger-connector-import",
      }),
  }).pipe(
    Effect.flatMap((module) =>
      module.ledgerLiveConnector({
        enabledChainsMap,
        isLedgerDappBrowser,
        queryParams,
        runWalletEffect,
      })
    )
  );
};

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  queryFn(opts).pipe(
    Effect.mapError(
      (cause) =>
        new WalletIntegrationError({
          cause,
          message: "Could not get ledger live config",
          operation: "ledger-config",
        })
    )
  );
