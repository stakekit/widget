import { useCallback, useMemo } from "react";
import { useWidgetConfig } from "../../../../features/widget-configuration/index";
import type { VariantProps } from "../../../../public-api/react-types";
import { Box } from "../../../../shared/ui/primitives/box";
import { useSKWallet } from "../../react/use-wallet";

export const ZerionChainModal = () => {
  const variant = useWidgetConfig("variant");
  const chainModal = useWidgetConfig("chainModal");

  const wallet = useSKWallet();
  const connectorChains = wallet?.connectorChains ?? [];
  const connector = wallet?.connector;
  const chain = wallet?.chain;

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

  if (
    variant !== "zerion" ||
    !chainModal ||
    !switchChain ||
    !connector ||
    !chain ||
    !wallet?.network
  ) {
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
