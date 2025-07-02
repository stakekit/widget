import { Maybe } from "purify-ts";
import { useCallback, useMemo } from "react";
import type { VariantProps } from "../../../providers/settings";
import { useSettings } from "../../../providers/settings";
import { useSKWallet } from "../../../providers/sk-wallet";
import { Box } from "../..";

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

  return Maybe.fromNullable(
    settings.chainModal({
      chainIds,
      selectedChainId: chain.id,
      onSwitchChain,
    })
  )
    .map((elem) => (
      <Box minHeight="8" data-rk="chain-modal">
        {elem}
      </Box>
    ))
    .extractNullable();
};
