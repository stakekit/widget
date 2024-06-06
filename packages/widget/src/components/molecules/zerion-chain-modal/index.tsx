import { useCallback, useMemo } from "react";
import { Box } from "../..";
import type { VariantProps } from "../../../providers/settings";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";

export const ZerionChainModal = () => {
  const settings = useSettings();

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

  if (settings.variant !== "zerion" || !switchChain || !connector) return null;

  return (
    <Box minHeight="8" data-rk="chain-modal">
      {settings.chainModal({
        chainIds,
        selectedChainId: chain.id,
        onSwitchChain,
      })}
    </Box>
  );
};
