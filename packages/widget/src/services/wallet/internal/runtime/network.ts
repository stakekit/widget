import type { Chain } from "wagmi/chains";
import type { SKWallet } from "../../wallet-connection";
import type { MiscChainsMap } from "../adapters/configured-chains";
import type { CosmosChainsMap } from "../adapters/cosmos/chains";
import type { EvmChainsMap } from "../adapters/evm/chains";
import type { SubstrateChainsMap } from "../adapters/substrate/chains";

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
