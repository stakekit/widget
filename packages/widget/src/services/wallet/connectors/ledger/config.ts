import type { WalletList } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import type { InitParams } from "../../../../domain/schema/init-params";
import { isLedgerDappBrowserProvider } from "../../browser-environment";
import { WalletIntegrationError } from "../../domain/errors";
import type { RunWalletEffect } from "../../effect-runner";
import type { EnabledChainsMap } from "./ledger-connector";

const queryFn = ({
  enabledChainsMap,
  queryParams,
  runWalletEffect,
}: {
  enabledChainsMap: EnabledChainsMap;
  queryParams: InitParams;
  runWalletEffect: RunWalletEffect;
}): Effect.Effect<
  {
    groupName: string;
    wallets: WalletList[number]["wallets"];
  } | null,
  WalletIntegrationError
> => {
  if (!isLedgerDappBrowserProvider()) return Effect.succeed(null);

  return Effect.tryPromise({
    try: () => import("./ledger-connector"),
    catch: (cause) =>
      new WalletIntegrationError({
        cause,
        message: "Could not import ledger-connector",
        operation: "ledger-connector-import",
      }),
  }).pipe(
    Effect.map((module) =>
      module.ledgerLiveConnector({
        enabledChainsMap,
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
