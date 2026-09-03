import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  appContainerElementAtom,
  appContainerSplitCollapsedAtom,
} from "../../src/features/widget-shell/state/app-container";
import {
  attachElement,
  detachElement,
} from "../../src/features/widget-shell/state/element-measurement";
import {
  animationLayoutHeightAtom,
  classicLayoutElementAtom,
  headerElementAtom,
  poweredByElementAtom,
} from "../../src/features/widget-shell/state/layout-height";

const appendElement = ({
  height,
  width,
}: {
  height?: number;
  width?: number;
}) => {
  const element = document.createElement("div");
  document.body.append(element);

  if (height !== undefined) {
    Object.defineProperty(element, "clientHeight", { value: height });
  }

  if (width !== undefined) {
    element.getBoundingClientRect = () => ({ width }) as DOMRect;
  }

  return element;
};

describe("animation layout height", () => {
  it("sums the classic layout, header, and powered-by heights", () => {
    const registry = AtomRegistry.make();
    registry.mount(animationLayoutHeightAtom);

    registry.set(
      headerElementAtom,
      attachElement(appendElement({ height: 40 }))
    );
    registry.set(
      poweredByElementAtom,
      attachElement(appendElement({ height: 20 }))
    );
    registry.set(
      classicLayoutElementAtom,
      attachElement(appendElement({ height: 100 }))
    );

    expect(registry.get(animationLayoutHeightAtom)).toBe(160);
  });

  it("keeps the incoming layout element when the outgoing one detaches", () => {
    const registry = AtomRegistry.make();
    registry.mount(animationLayoutHeightAtom);

    registry.set(
      headerElementAtom,
      attachElement(appendElement({ height: 40 }))
    );
    registry.set(
      poweredByElementAtom,
      attachElement(appendElement({ height: 20 }))
    );

    const outgoing = appendElement({ height: 100 });
    const incoming = appendElement({ height: 120 });

    registry.set(classicLayoutElementAtom, attachElement(outgoing));
    registry.set(classicLayoutElementAtom, attachElement(incoming));
    registry.set(classicLayoutElementAtom, detachElement(outgoing));

    expect(registry.get(classicLayoutElementAtom)).toBe(incoming);
    expect(registry.get(animationLayoutHeightAtom)).toBe(180);

    registry.set(classicLayoutElementAtom, detachElement(incoming));

    expect(registry.get(classicLayoutElementAtom)).toBeNull();
  });

  it("retains the last non-zero layout height while a route check redirects", () => {
    const registry = AtomRegistry.make();
    registry.mount(animationLayoutHeightAtom);

    registry.set(
      headerElementAtom,
      attachElement(appendElement({ height: 40 }))
    );
    registry.set(
      poweredByElementAtom,
      attachElement(appendElement({ height: 20 }))
    );
    registry.set(
      classicLayoutElementAtom,
      attachElement(appendElement({ height: 100 }))
    );
    registry.set(
      classicLayoutElementAtom,
      attachElement(appendElement({ height: 0 }))
    );

    expect(registry.get(animationLayoutHeightAtom)).toBe(160);
  });

  it("retains the last measured header height while the header is detached", () => {
    const registry = AtomRegistry.make();
    registry.mount(animationLayoutHeightAtom);

    const header = appendElement({ height: 40 });

    registry.set(headerElementAtom, attachElement(header));
    registry.set(
      poweredByElementAtom,
      attachElement(appendElement({ height: 20 }))
    );
    registry.set(
      classicLayoutElementAtom,
      attachElement(appendElement({ height: 100 }))
    );
    registry.set(headerElementAtom, detachElement(header));

    expect(registry.get(animationLayoutHeightAtom)).toBe(160);
  });
});

describe("app container split view", () => {
  it("collapses the split view for a narrow app container", () => {
    const registry = AtomRegistry.make();
    registry.mount(appContainerSplitCollapsedAtom);

    registry.set(
      appContainerElementAtom,
      attachElement(appendElement({ width: 500 }))
    );

    expect(registry.get(appContainerSplitCollapsedAtom)).toBe(true);
  });

  it("retains the last measured width while the app container is detached", () => {
    const registry = AtomRegistry.make();
    registry.mount(appContainerSplitCollapsedAtom);

    const appContainer = appendElement({ width: 500 });

    registry.set(appContainerElementAtom, attachElement(appContainer));
    registry.set(appContainerElementAtom, detachElement(appContainer));

    expect(registry.get(appContainerSplitCollapsedAtom)).toBe(true);
  });
});
