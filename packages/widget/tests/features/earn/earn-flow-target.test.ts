import { Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it } from "vitest";
import {
  ProviderId,
  ProviderOption,
} from "../../../src/domain/identity/identifiers";
import {
  earnFlowProviderOptionAtom,
  earnFlowYieldAtom,
} from "../../../src/features/earn/state/flow-target";
import { enrichedYieldOpportunityResourceAtom } from "../../../src/resources/yield-opportunity/index";
import { yieldProviderResourceAtom } from "../../../src/resources/yield-provider/index";
import { yieldApiProviderFixture, yieldApiYieldFixture } from "../../fixtures";

const provider = yieldApiProviderFixture({ name: "Kiln" });
const captured = { ...yieldApiYieldFixture(), provider };

describe("Earn flow target", () => {
  it("keeps the captured Yield while the live Yield is unavailable", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          enrichedYieldOpportunityResourceAtom.local(captured.id),
          AsyncResult.initial(true)
        ),
      ],
    });

    expect(registry.get(earnFlowYieldAtom(captured))).toBe(captured);
  });

  it("keeps the captured provider when live enrichment lacks one", () => {
    const { provider: _provider, ...liveWithoutProvider } = {
      ...captured,
      metadata: { ...captured.metadata, name: "Live name" },
    };
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          enrichedYieldOpportunityResourceAtom.local(captured.id),
          AsyncResult.success(liveWithoutProvider)
        ),
      ],
    });

    const flowYield = registry.get(earnFlowYieldAtom(captured));

    expect(flowYield.metadata.name).toBe("Live name");
    expect(flowYield.provider).toBe(provider);
  });

  it("keeps the captured provider option details when the live lookup has none", () => {
    const value = ProviderOption.make("kiln");
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          yieldProviderResourceAtom.local(ProviderId.make(value)),
          AsyncResult.success(Option.none())
        ),
      ],
    });

    expect(
      registry.get(earnFlowProviderOptionAtom({ provider, value })).provider
    ).toBe(provider);
  });
});
