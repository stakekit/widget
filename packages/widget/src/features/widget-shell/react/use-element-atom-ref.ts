import { useAtomSet } from "@effect/atom-react";
import { useRef } from "react";
import {
  attachElement,
  detachElement,
  type ElementSlotAtom,
} from "../state/element-measurement";

export const useElementAtomRef = (elementAtom: ElementSlotAtom) => {
  const setElement = useAtomSet(elementAtom);
  const attached = useRef<HTMLElement | null>(null);

  const detachAttached = () => {
    if (attached.current) setElement(detachElement(attached.current));

    attached.current = null;
  };

  return (element: HTMLElement | null) => {
    /**
     * React 19 calls the returned cleanup, while React 18 hosts clear a
     * callback ref by calling it with null instead.
     */
    if (!element) {
      detachAttached();
      return;
    }

    attached.current = element;
    setElement(attachElement(element));

    return detachAttached;
  };
};
