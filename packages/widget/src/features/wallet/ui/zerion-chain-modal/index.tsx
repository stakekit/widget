import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import { Box } from "../../../../ui/index";
import { useSKWallet } from "../../react/use-wallet";

export const ZerionChainModal = () => {
  const chainModal = useWidgetConfig("chainModal");

  const wallet = useSKWallet();
  const connectorChains = wallet?.connectorChains ?? [];
  const connector = wallet?.connector;
  const chain = wallet?.chain;

  const chainIds = connectorChains.map((c) => c.id);

  const switchChain = connector?.switchChain;

  const onSwitchChain = (chainId: number) => switchChain?.({ chainId });

  if (!chainModal || !switchChain || !connector || !chain || !wallet?.network) {
    return null;
  }

  const content = chainModal({
    chainIds,
    selectedChainId: chain.id,
    onSwitchChain,
  });
  return content ? <Box hostHook="chain-modal">{content}</Box> : null;
};
