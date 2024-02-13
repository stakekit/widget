import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "../../utils";
import { MiscChainsMap } from "../../domain/types/chains";
import { MiscNetworks } from "@stakekit/common";
import { queryClient } from "../../services/query-client";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { config } from "../../config";
import { EitherAsync, Maybe } from "purify-ts";
import { near, solana, tezos, tron } from "./chains";
import { WalletList } from "@stakekit/rainbowkit";
import { tronConnector } from "./tron-connector";

const queryKey = [config.appPrefix, "misc-config"];
const staleTime = Infinity;

const queryFn = async () =>
  getEnabledNetworks().caseOf({
    Right: (networks) => {
      const miscChainsMap: Partial<MiscChainsMap> = typeSafeObjectFromEntries(
        typeSafeObjectEntries<MiscChainsMap>({
          [MiscNetworks.Near]: {
            type: "misc",
            skChainName: MiscNetworks.Near,
            wagmiChain: near,
          },
          [MiscNetworks.Tezos]: {
            type: "misc",
            skChainName: MiscNetworks.Tezos,
            wagmiChain: tezos,
          },
          [MiscNetworks.Solana]: {
            type: "misc",
            skChainName: MiscNetworks.Solana,
            wagmiChain: solana,
          },
          [MiscNetworks.Tron]: {
            type: "misc",
            skChainName: MiscNetworks.Tron,
            wagmiChain: tron,
          },
        }).filter(([_, v]) => networks.has(v.skChainName))
      );

      const miscChains = Object.values(miscChainsMap).map(
        (val) => val.wagmiChain
      );

      const connectors: Maybe<WalletList[number]>[] = [
        Maybe.fromPredicate(() => !!miscChainsMap.tron, tronConnector),
      ];

      return Promise.resolve({ miscChainsMap, miscChains, connectors });
    },
    Left: (l) => Promise.reject(l),
  });

export const getConfig = () =>
  EitherAsync(() =>
    queryClient.fetchQuery({ staleTime, queryKey, queryFn })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get misc config");
  });
