import { Array as EArray, Effect, Record } from "effect";
import type { Network } from "../../../../../domain/network/network";
import type { Chain, WalletList } from "../../../wallet-descriptors";
import { WalletIntegrationError } from "../../../wallet-errors";
import type { WalletConnectProtocol } from "../../platform/wallet-connect-protocol";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import { type SubstrateChainsMap, substrateChainsMap } from "./chains";

export const getConfig = ({
  buildConnectors,
  enabledNetworks,
  walletConnectProtocol,
  runWalletEffect,
}: {
  buildConnectors: boolean;
  enabledNetworks: ReadonlySet<Network>;
  walletConnectProtocol: WalletConnectProtocol;
  runWalletEffect: RunWalletEffect;
}): Effect.Effect<
  {
    substrateChainsMap: Partial<SubstrateChainsMap>;
    substrateChains: Chain[];
    connector: {
      groupName: string;
      wallets: WalletList[number]["wallets"];
    } | null;
  },
  WalletIntegrationError
> =>
  Effect.gen(function* () {
    const filteredSubstrateChainsMap: Partial<SubstrateChainsMap> =
      Record.filter(substrateChainsMap, (v) => enabledNetworks.has(v.network));
    const enabledChains = Object.values(filteredSubstrateChainsMap);

    const connector =
      buildConnectors && EArray.isReadonlyArrayNonEmpty(enabledChains)
        ? yield* Effect.tryPromise({
            try: () => import("./substrate-connector"),
            catch: (cause) =>
              new WalletIntegrationError({
                cause,
                message: "Could not import substrate-connector",
                operation: "substrate-connector-import",
              }),
          }).pipe(
            Effect.flatMap((module) =>
              module.getSubstrateConnectors({
                chains: enabledChains,
                walletConnectProtocol,
                runWalletEffect,
              })
            )
          )
        : null;

    return {
      substrateChainsMap: filteredSubstrateChainsMap,
      substrateChains: enabledChains.map((chain) => chain.wagmiChain),
      connector,
    };
  }).pipe(
    Effect.mapError(
      (cause) =>
        new WalletIntegrationError({
          cause,
          message: "Could not get substrate config",
          operation: "substrate-config",
        })
    )
  );
