import * as Atom from "effect/unstable/reactivity/Atom";
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

export const classicLayoutElementAtom = makeElementAtom(
  "classicLayoutElementAtom"
);
export const headerElementAtom = makeElementAtom("headerElementAtom");
export const poweredByElementAtom = makeElementAtom("poweredByElementAtom");

const classicLayoutHeightAtom = makeElementHeightAtom({
  elementAtom: classicLayoutElementAtom,
  label: "classicLayoutHeightAtom",
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
  const classicLayoutHeight = get(classicLayoutHeightAtom);
  const headerHeight = get(headerHeightAtom);

  if (classicLayoutHeight === 0 || headerHeight === 0) return 0;

  return classicLayoutHeight + headerHeight + get(poweredByHeightAtom);
}).pipe(Atom.withLabel("animationLayoutHeightAtom"));
