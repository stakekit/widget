import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { isHostExternalProvider } from "../../../services/wallet/external-provider-connector-id";
import type { ConnectorWithWalletDetails } from "../../../services/wallet/wallet-descriptors";
import { currentWalletStateResultAtom } from "./root-atom";
import { walletIconUrlAtom } from "./wallet-icon";

/**
 * The wallet the account is connected through, as the account dialog names
 * it: its connector's name, and its logo once the logo resolved. Null
 * without a wallet the user would know by name: no connector, or the host's
 * External Provider, whose connector name is the Widget's own.
 */
export const connectedWalletAtom = Atom.make((get) => {
  const connected =
    Option.getOrNull(AsyncResult.value(get(currentWalletStateResultAtom)))
      ?.connector ?? null;
  const connector: ConnectorWithWalletDetails | null =
    connected && !isHostExternalProvider(connected) ? connected : null;
  if (!connector) return null;

  const logo = get(
    walletIconUrlAtom(
      connector.walletDetails?.iconUrl || connector.icon || undefined
    )
  );
  return {
    name: connector.name,
    ...(logo === undefined ? {} : { logo }),
  };
}).pipe(Atom.withLabel("connectedWalletAtom"));
