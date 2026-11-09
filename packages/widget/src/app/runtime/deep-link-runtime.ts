import { Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";

import { walletRuntime } from "../../runtime/wallet-runtime";
import { DeepLinkCoordinator } from "./deep-link-coordinator";

/**
 * The Wallet Runtime plus the Deep Link Coordinator. The coordinator starts
 * Yield Transaction Flows, so it is assembled here, above the Features, rather
 * than in the Wallet Runtime they build on.
 */
export const deepLinkRuntime = Atom.runtime((get) =>
  DeepLinkCoordinator.layer.pipe(Layer.provideMerge(get(walletRuntime.layer)))
);
