import * as Atom from "effect/unstable/reactivity/Atom";
import {
  normalizeWidgetApiConfig,
  normalizeWidgetBootstrapConfig,
} from "../../services/config/widget-config";
import { widgetConfigAtom } from "./settings";

export { normalizeWidgetApiConfig };

export const widgetBootstrapConfigAtom = Atom.make((get) => {
  const settings = get(widgetConfigAtom);

  return normalizeWidgetBootstrapConfig({
    isLedgerLive: settings.isLedgerLive,
    settings,
  });
}).pipe(Atom.keepAlive, Atom.withLabel("widgetBootstrapConfigAtom"));
