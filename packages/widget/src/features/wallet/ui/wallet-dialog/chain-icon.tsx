import { useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import { walletChainIcon } from "../../../../services/wallet/wallet-chain-icons";
import type { Chain } from "../../../../services/wallet/wallet-descriptors";
import { Box } from "../../../../shared/ui/primitives/box";
import {
  Monogram,
  monogramInitial,
} from "../../../../shared/ui/primitives/image";
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
  const src = useAtomValue(walletIconUrlAtom(icon.iconUrl));
  const [failedSrc, setFailedSrc] = useState<string>();
  const initial = monogramInitial(chain.name);

  if (src === undefined || src === failedSrc) {
    return initial === undefined ? null : (
      <Monogram
        initial={initial}
        className={className}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Box
      as="img"
      src={src}
      alt=""
      onError={() => setFailedSrc(src)}
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
