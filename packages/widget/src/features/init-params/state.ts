import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetBootstrapConfigAtom } from "../../app/config/widget-config";
import { decodeInitParams } from "../../services/wallet/init-params";
import { getLocationHref } from "../../shared/lib/location";

export const initParamsAtom = Atom.make((get) => {
  const externalProviderInitToken = get(widgetBootstrapConfigAtom).wallet
    .externalProviderInitToken;

  return decodeInitParams({
    externalProviderInitToken,
    href: getLocationHref(),
  });
}).pipe(Atom.keepAlive, Atom.withLabel("initParamsAtom"));
