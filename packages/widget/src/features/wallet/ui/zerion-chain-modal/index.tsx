import { useCallback, useMemo } from "react";
import { useWidgetConfig } from "../../../../app/config";
import type { VariantProps } from "../../../../public-api/types";
import { Box } from "../../../../shared/ui/primitives/box";
import { useSKWallet } from "../../react/use-wallet";

export const ZerionChainModal = () => {
  const variant = useWidgetConfig("variant");
  const chainModal = useWidgetConfig("chainModal");

  const { connectorChains, connector, chain } = useSKWallet();

  const chainIds = useMemo(
    () => connectorChains.map((c) => c.id),
    [connectorChains]
  );

  const switchChain = connector?.switchChain;

  const onSwitchChain = useCallback<
    Parameters<
      Extract<VariantProps, { variant: "zerion" }>["chainModal"]
    >[0]["onSwitchChain"]
  >((chainId) => switchChain?.({ chainId }), [switchChain]);

  if (variant !== "zerion" || !chainModal || !switchChain || !connector) {
    return null;
  }

  const content = chainModal({
    chainIds,
    selectedChainId: chain.id,
    onSwitchChain,
  });
  return content ? (
    <Box minHeight="8" data-rk="chain-modal">
      {content}
    </Box>
  ) : null;
};
