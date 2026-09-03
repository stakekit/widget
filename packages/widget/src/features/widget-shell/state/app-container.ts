import * as Atom from "effect/unstable/reactivity/Atom";
import { isSplitCollapsedWidth } from "../../../shared/styles/tokens/breakpoints";
import {
  makeElementAtom,
  makeElementMeasurementAtom,
} from "./element-measurement";

export const appContainerElementAtom = makeElementAtom(
  "appContainerElementAtom"
);

/**
 * Layout decisions use the app container rather than the viewport because a
 * host can embed the widget in a container narrower than the browser window.
 */
const appContainerWidthAtom = makeElementMeasurementAtom<number | null>({
  elementAtom: appContainerElementAtom,
  initialValue: null,
  label: "appContainerWidthAtom",
  measure: (element) => element.getBoundingClientRect().width,
});

export const appContainerSplitCollapsedAtom = Atom.make((get) => {
  const width = get(appContainerWidthAtom);

  return width !== null && isSplitCollapsedWidth(width);
}).pipe(Atom.withLabel("appContainerSplitCollapsedAtom"));
