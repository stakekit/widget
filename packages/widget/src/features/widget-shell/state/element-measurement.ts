import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

type ElementSlotUpdate =
  | { readonly _tag: "Attached"; readonly element: HTMLElement }
  | { readonly _tag: "Detached"; readonly element: HTMLElement };

export const attachElement = (element: HTMLElement): ElementSlotUpdate => ({
  _tag: "Attached",
  element,
});

export const detachElement = (element: HTMLElement): ElementSlotUpdate => ({
  _tag: "Detached",
  element,
});

export type ElementSlotAtom = Atom.Writable<
  HTMLElement | null,
  ElementSlotUpdate
>;

export const makeElementAtom = (label: string): ElementSlotAtom => {
  const slot: ElementSlotAtom = Atom.writable<
    HTMLElement | null,
    ElementSlotUpdate
  >(
    () => null,
    (ctx, update) => {
      if (update._tag === "Attached") {
        ctx.setSelf(update.element);
        return;
      }

      /**
       * Route animations keep the outgoing instance mounted while the incoming
       * one renders, so a detach that lost the race must not clear the slot the
       * incoming instance already claimed.
       */
      if (ctx.get(slot) === update.element) ctx.setSelf(null);
    }
  ).pipe(Atom.keepAlive, Atom.withLabel(label));

  return slot;
};

/**
 * Publishes a measurement of `elementAtom`'s element, keeping the last known
 * value while no element is attached so layout does not collapse between the
 * outgoing and incoming instances of a route.
 */
export const makeElementMeasurementAtom = <Value>({
  elementAtom,
  initialValue,
  label,
  measure,
}: {
  elementAtom: Atom.Atom<HTMLElement | null>;
  initialValue: Value;
  label: string;
  measure: (element: HTMLElement, previousValue: Value) => Value;
}) =>
  Atom.make((get) => {
    const previousValue = () =>
      get.self<Value>().pipe(Option.getOrElse(() => initialValue));
    const element = get(elementAtom);

    if (!element) return previousValue();

    const read = () => measure(element, previousValue());

    if (typeof ResizeObserver === "undefined") return read();

    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0) get.setSelf(read());
    });

    observer.observe(element);
    get.addFinalizer(() => observer.disconnect());

    return read();
  }).pipe(Atom.withLabel(label));
