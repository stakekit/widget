import * as Atom from "effect/unstable/reactivity/Atom";
import { widgetBootstrapConfigAtom } from "../../app/config";
import { decodeInitParams } from "./decode";

export const initParamsAtom = Atom.make((get) => {
  const externalProviderInitToken = get(widgetBootstrapConfigAtom).wallet
    .externalProviderInitToken;

  return decodeInitParams({
    externalProviderInitToken,
    href: globalThis.location?.href ?? "http://localhost",
  });
}).pipe(Atom.keepAlive, Atom.withLabel("initParamsAtom"));
