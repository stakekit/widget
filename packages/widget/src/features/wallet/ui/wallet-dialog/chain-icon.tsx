import { useAtomValue } from "@effect/atom-react";
import { walletChainIcon } from "../../../../services/wallet/wallet-chain-icons";
import type { Chain } from "../../../../services/wallet/wallet-descriptors";
import { Avatar } from "../../../../ui/index";
import { walletIconUrlAtom } from "../../state/wallet-icon";

/** A chain's icon URL, once a host's lazy loader resolves; unset without one. */
export const useWalletChainIconUrl = (chain: Chain | undefined) =>
  useAtomValue(
    walletIconUrlAtom(
      chain === undefined ? undefined : walletChainIcon(chain).iconUrl
    )
  );

/**
 * A chain's icon, decorative beside the chain's name in a compact picker row;
 * the name's initial shows while it loads, when it fails or without one.
 */
export const WalletChainIcon = ({ chain }: { readonly chain: Chain }) => (
  <Avatar
    src={useWalletChainIconUrl(chain)}
    fallback={Array.from(chain.name.trim())[0]?.toUpperCase() ?? ""}
    size="control"
  />
);
