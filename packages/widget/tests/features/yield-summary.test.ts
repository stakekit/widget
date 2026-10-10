import { Effect, Layer } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { exactDecimal } from "../../src/domain/finance/exact";
import { resolveYieldSummaryView } from "../../src/features/yield-summary/model/yield-summary";
import { makeYieldSummary } from "../../src/features/yield-summary/state/yield-summary";
import { YieldResourceSource } from "../../src/services/api/resource-sources";
import {
  yieldApiValidatorFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { decodeValidator } from "../utils/validators";

describe("Yield Summary", () => {
  it("publishes semantic provider, reward-token, and yield-type facts", () => {
    const selectedYield = yieldApiYieldFixture();
    const view = resolveYieldSummaryView({
      validators: new Map(),
      yield: selectedYield,
    });

    expect(view).toMatchObject({
      providers: [
        {
          name: selectedYield.metadata.name,
        },
      ],
      rewardToken: null,
    });
    expect(view.yieldType).not.toBeNull();
  });

  it("summarizes validators of a yield with provider options without reading the yield directory", () => {
    const base = yieldApiYieldDtoFixture();
    const selectedYield = yieldApiYieldFixture({
      mechanics: {
        ...base.mechanics,
        arguments: {
          ...base.mechanics.arguments,
          enter: {
            fields: [
              {
                label: "Provider",
                name: "providerId",
                options: ["P2P"],
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
    });
    const listYields = vi.fn(() => Effect.die("yield directory was queried"));
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              getProvider: () => Effect.succeedNone,
              listYields,
            } as never)
          )
        ),
      ],
    });
    const summary = makeYieldSummary(
      Atom.make({
        validators: [
          decodeValidator(
            yieldApiValidatorFixture({
              name: "Validator A",
              rewardRate: {
                components: [],
                rateType: "APY",
                total: 0.01,
              },
            })
          ),
        ],
        yield: selectedYield,
      })
    );

    try {
      expect(registry.get(summary.viewAtom)).toMatchObject({
        providers: [{ name: "Validator A", rewardRate: exactDecimal("0.01") }],
      });
      expect(listYields).not.toHaveBeenCalled();
    } finally {
      registry.dispose();
    }
  });
});
