import * as Atom from "effect/reactivity/Atom";
import {
  makeElementAtom,
  makeElementMeasurementAtom,
} from "./element-measurement";

const makeElementHeightAtom = ({
  elementAtom,
  label,
  measure = (element) => element.clientHeight,
}: {
  elementAtom: Atom.Atom<HTMLElement | null>;
  label: string;
  measure?: (element: HTMLElement, previousHeight: number) => number;
}) =>
  makeElementMeasurementAtom({
    elementAtom,
    initialValue: 0,
    label,
    measure,
  });

export const compactLayoutElementAtom = makeElementAtom(
  "compactLayoutElementAtom"
);
export const headerElementAtom = makeElementAtom("headerElementAtom");
export const poweredByElementAtom = makeElementAtom("poweredByElementAtom");

const compactLayoutHeightAtom = makeElementHeightAtom({
  elementAtom: compactLayoutElementAtom,
  label: "compactLayoutHeightAtom",
  /**
   * Route checks can briefly render a Navigate with zero height. Retaining the
   * prior layout height prevents the outer container from jumping.
   */
  measure: (element, previousHeight) =>
    element.clientHeight === 0 ? previousHeight : element.clientHeight,
});
const headerHeightAtom = makeElementHeightAtom({
  elementAtom: headerElementAtom,
  label: "headerHeightAtom",
});
const poweredByHeightAtom = makeElementHeightAtom({
  elementAtom: poweredByElementAtom,
  label: "poweredByHeightAtom",
});

export const animationLayoutHeightAtom = Atom.make((get) => {
  const compactLayoutHeight = get(compactLayoutHeightAtom);
  const headerHeight = get(headerHeightAtom);

  if (compactLayoutHeight === 0 || headerHeight === 0) return 0;

  return compactLayoutHeight + headerHeight + get(poweredByHeightAtom);
}).pipe(Atom.withLabel("animationLayoutHeightAtom"));
