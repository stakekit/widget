import * as Atom from "effect/reactivity/Atom";

import { widgetBootstrapSnapshotAtom } from "../../../runtime/widget-config";
import { decodeInitParams } from "../../../services/wallet/init-params";
import { getLocationHref } from "../../../shared/lib/location";

export const initParamsAtom = Atom.make((get) => {
  const externalProviderInitToken = get(widgetBootstrapSnapshotAtom).wallet
    .externalProviderInitToken;

  return decodeInitParams({
    externalProviderInitToken,
    href: getLocationHref(),
  });
}).pipe(Atom.keepAlive, Atom.withLabel("initParamsAtom"));
