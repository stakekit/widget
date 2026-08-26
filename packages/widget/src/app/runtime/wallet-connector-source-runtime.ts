import * as Atom from "effect/unstable/reactivity/Atom";
import { WalletConnectorSource } from "../../services/wallet/wallet-connector-source";

export const walletConnectorSourceRuntime = Atom.runtime(
  WalletConnectorSource.defaultLayer
);
