import { walletChainIcon } from "../../../../services/wallet/wallet-chain-icons";
import type { Chain } from "../../../../services/wallet/wallet-descriptors";
import { Box } from "../../../../shared/ui/primitives/box";
import { useWalletIconUrl } from "./icon-url";

export const WalletChainIcon = ({
  chain,
  className,
  size,
}: {
  readonly chain: Chain;
  readonly className?: string;
  readonly size?: number;
}) => {
  const icon = walletChainIcon(chain);
  const src = useWalletIconUrl(icon.iconUrl);
  if (!src) return null;
  return (
    <Box
      as="img"
      src={src}
      alt=""
      className={className}
      style={{
        background: icon.iconBackground,
        width: size,
        height: size,
        borderRadius: "50%",
      }}
    />
  );
};
