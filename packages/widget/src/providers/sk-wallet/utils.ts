import type { CosmosChainsMap } from "@sk-widget/domain/types/chains/cosmos";
import type { EvmChainsMap } from "@sk-widget/domain/types/chains/evm";
import type { MiscChainsMap } from "@sk-widget/domain/types/chains/misc";
import type { SubstrateChainsMap } from "@sk-widget/domain/types/chains/substrate";
import type { SKWallet } from "@sk-widget/domain/types/wallet";
import type { Chain } from "wagmi/chains";

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
