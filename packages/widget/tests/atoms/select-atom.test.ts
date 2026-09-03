import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { selectAtom } from "../../src/shared/effect/select-atom";

describe("selectAtom", () => {
  it("does not propagate unrelated source changes", () => {
    const source = Atom.make({
      address: "address-1",
      network: "network-1",
      other: 1,
    });
    const selection = selectAtom(source, ({ address, network }) => ({
      address,
      network,
    }));
    let dependentRuns = 0;
    const dependent = Atom.make((get) => {
      dependentRuns += 1;
      return get(selection);
    });
    const registry = AtomRegistry.make();
    const unmount = registry.mount(dependent);
    const initialSelection = registry.get(selection);

    registry.set(source, {
      address: "address-1",
      network: "network-1",
      other: 2,
    });

    expect(registry.get(selection)).toBe(initialSelection);
    expect(dependentRuns).toBe(1);
    unmount();
    registry.dispose();
  });

  it("publishes simultaneous field changes as one atomic selection", () => {
    const source = Atom.make({
      address: "address-1",
      network: "network-1",
    });
    const selection = selectAtom(source, ({ address, network }) => ({
      address,
      network,
    }));
    const registry = AtomRegistry.make();
    const observed: string[] = [];
    const unmount = registry.subscribe(
      selection,
      ({ address, network }) => observed.push(`${address}:${network}`),
      { immediate: true }
    );

    registry.set(source, {
      address: "address-2",
      network: "network-2",
    });

    expect(observed).toEqual(["address-1:network-1", "address-2:network-2"]);
    unmount();
    registry.dispose();
  });
});
