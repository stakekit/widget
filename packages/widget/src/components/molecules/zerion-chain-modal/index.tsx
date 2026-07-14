import { useCallback, useMemo } from "react";
import { useSettings } from "../../../providers/settings";
import type { VariantProps } from "../../../providers/settings/types";
import { useSKWallet } from "../../../providers/wallet/react/use-wallet";
import { Box } from "../../atoms/box";

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

  const content = settings.chainModal({
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
