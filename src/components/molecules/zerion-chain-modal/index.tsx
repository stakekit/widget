import { Box } from "../..";
import { useSettings } from "../../../providers/settings";
import { ChainModal } from "../chain-modal";

export const ZerionChainModal = () => {
  const { variant } = useSettings();

  if (variant !== "zerion") return null;

  return (
    <Box minHeight="8" data-rk="chain-modal">
      <ChainModal />
    </Box>
  );
};
