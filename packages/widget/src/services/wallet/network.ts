import type { Chain } from "wagmi/chains";
import type { CosmosChainsMap } from "../../domain/types/chains/cosmos";
import type { EvmChainsMap } from "../../domain/types/chains/evm";
import type { MiscChainsMap } from "../../domain/types/chains/misc";
import type { SubstrateChainsMap } from "../../domain/types/chains/substrate";
import type { SKWallet } from "../../domain/types/wallet";

export const wagmiNetworkToSKNetwork = ({
  chain,
  cosmosChainsMap,
  evmChainsMap,
  miscChainsMap,
  substrateChainsMap,
}: {
  chain: Chain;
  evmChainsMap: Partial<EvmChainsMap>;
  cosmosChainsMap: Partial<CosmosChainsMap>;
  miscChainsMap: Partial<MiscChainsMap>;
  substrateChainsMap: Partial<SubstrateChainsMap>;
}): SKWallet["network"] => {
  return (
    Object.values({
      ...evmChainsMap,
      ...cosmosChainsMap,
      ...miscChainsMap,
      ...substrateChainsMap,
    }).find((c) => c.wagmiChain.id === chain.id)?.skChainName ?? null
  );
};
