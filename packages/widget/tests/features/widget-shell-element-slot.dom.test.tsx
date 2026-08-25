import { RegistryContext } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useElementAtomRef } from "../../src/features/widget-shell/react/use-element-atom-ref";
import { classicLayoutElementAtom } from "../../src/features/widget-shell/state/layout-height";
import { render } from "../utils/test-utils.dom.tsx";

const Layout = ({ name }: { name: string }) => {
  const layoutRef = useElementAtomRef(classicLayoutElementAtom);

  return <div ref={layoutRef} data-testid={name} />;
};

const findLayout = (container: HTMLElement, name: string) =>
  container.querySelector(`[data-testid="${name}"]`);

describe("layout element slot", () => {
  const renderWithRegistry = async (registry: AtomRegistry.AtomRegistry) => {
    const app = await render(<RegistryContext.Provider value={registry} />);

    return {
      container: app.container,
      show: (children: ReactNode) =>
        app.rerender(
          <RegistryContext.Provider value={registry}>
            {children}
          </RegistryContext.Provider>
        ),
    };
  };

  it("keeps the incoming layout element while the outgoing one unmounts", async () => {
    const registry = AtomRegistry.make();
    const app = await renderWithRegistry(registry);

    await app.show(<Layout key="outgoing" name="outgoing" />);

    expect(registry.get(classicLayoutElementAtom)).toBe(
      findLayout(app.container, "outgoing")
    );

    await app.show(
      <>
        <Layout key="outgoing" name="outgoing" />
        <Layout key="incoming" name="incoming" />
      </>
    );

    const incoming = findLayout(app.container, "incoming");

    await app.show(<Layout key="incoming" name="incoming" />);

    expect(registry.get(classicLayoutElementAtom)).toBe(incoming);
  });

  it("clears the slot once the owning layout unmounts", async () => {
    const registry = AtomRegistry.make();
    const app = await renderWithRegistry(registry);

    await app.show(<Layout name="only" />);
    await app.show(null);

    expect(registry.get(classicLayoutElementAtom)).toBeNull();
  });
});
