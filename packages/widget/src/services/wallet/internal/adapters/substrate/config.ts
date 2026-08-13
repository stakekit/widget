import type { Chain as LunoKitChain } from "@luno-kit/core/chains";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { Effect, Record } from "effect";
import type { Network } from "../../../../../domain/network/network";
import { WalletIntegrationError } from "../../../wallet-errors";
import { getWalletNetworkLogo } from "../../runtime/assets";
import { type SubstrateChainsMap, substrateChainsMap } from "./chains";

const enabledSubstrateChains = (enabledNetworks: ReadonlySet<Network>) => {
  const filteredSubstrateChainsMap: Partial<SubstrateChainsMap> = Record.filter(
    substrateChainsMap,
    (v) => enabledNetworks.has(v.skChainName)
  );

  const substrateChains = Object.values(filteredSubstrateChainsMap).map(
    (val) => val.wagmiChain
  );

  const lunoKitChains = Object.values(filteredSubstrateChainsMap).map(
    (val): LunoKitChain => ({
      ...val.wagmiChain,
      rpcUrls: {
        webSocket: [],
      },
      testnet: false,
      chainIconUrl:
        typeof val.wagmiChain.iconUrl === "string"
          ? val.wagmiChain.iconUrl
          : getWalletNetworkLogo(val.skChainName),
      genesisHash: val.genesisHash as `0x${string}`,
      ss58Format: val.ss58Format,
    })
  );

  return { filteredSubstrateChainsMap, lunoKitChains, substrateChains };
};

export const getConfig = ({
  buildConnectors,
  enabledNetworks,
  forceWalletConnectOnly,
}: {
  buildConnectors: boolean;
  enabledNetworks: ReadonlySet<Network>;
  forceWalletConnectOnly: boolean;
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
    const { filteredSubstrateChainsMap, lunoKitChains, substrateChains } =
      enabledSubstrateChains(enabledNetworks);

    const connector =
      buildConnectors && substrateChains.length
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
              module.getSubstrateConnectors(
                substrateChains,
                lunoKitChains,
                forceWalletConnectOnly
              )
            )
          )
        : null;

    return {
      substrateChainsMap: filteredSubstrateChainsMap,
      substrateChains,
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
