import { useAtomValue } from "@effect/atom-react";
import type { SyntheticEvent } from "react";
import { walletChainIcon } from "../../../../services/wallet/wallet-chain-icons";
import type { Chain } from "../../../../services/wallet/wallet-descriptors";
import { Box } from "../../../../shared/ui/primitives/box";
import { createMonogramImageSrc } from "../../../../shared/ui/primitives/image";
import { walletIconUrlAtom } from "../../state/wallet-icon";

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
  const fallbackSrc = createMonogramImageSrc(chain.name);
  const src = useAtomValue(walletIconUrlAtom(icon.iconUrl)) ?? fallbackSrc;
  if (!src) return null;

  const onError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (fallbackSrc && event.currentTarget.src !== fallbackSrc) {
      event.currentTarget.src = fallbackSrc;
    }
  };

  return (
    <Box
      as="img"
      src={src}
      alt=""
      onError={onError}
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
