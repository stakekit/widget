import { Cause, Effect, Layer, Option } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { exactDecimal } from "../../src/domain/finance/exact";
import { resolveYieldSummaryView } from "../../src/features/yield-summary/model/yield-summary";
import { makeYieldSummary } from "../../src/features/yield-summary/state/yield-summary";
import { YieldDirectoryError } from "../../src/resources/yield-directory/index";
import type { YieldDirectoryRequest } from "../../src/services/api/resource-sources";
import {
  ApiRequestError,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import {
  yieldApiProviderFixture,
  yieldApiValidatorFixture,
  yieldApiYieldDtoFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { decodeValidator } from "../utils/validators";

describe("Yield Summary", () => {
  it("publishes loading before provider Yield data settles", () => {
    const view = resolveYieldSummaryView({
      input: {
        selectedProviderYieldId: null,
        validators: new Map(),
        yield: yieldApiYieldFixture(),
      },
      providerYieldsResult: AsyncResult.initial(true),
    });

    expect(view).toMatchObject({
      error: null,
      providers: null,
      status: "loading",
    });
  });

  it("publishes semantic provider, reward-token, and yield-type facts", () => {
    const selectedYield = yieldApiYieldFixture();
    const view = resolveYieldSummaryView({
      input: {
        selectedProviderYieldId: null,
        validators: new Map(),
        yield: selectedYield,
      },
      providerYieldsResult: AsyncResult.success([]),
    });

    expect(view).toMatchObject({
      error: null,
      providers: [
        {
          name: selectedYield.metadata.name,
        },
      ],
      rewardToken: null,
      status: "ready",
    });
    expect(view.yieldType).not.toBeNull();
  });

  it("normalizes an unavailable provider-yield resource", () => {
    const failure = new YieldDirectoryError({
      cause: new ApiRequestError({
        cause: new Error("provider yields unavailable"),
        operation: "yield-directory",
      }),
    });
    const view = resolveYieldSummaryView({
      input: {
        selectedProviderYieldId: null,
        validators: new Map(),
        yield: yieldApiYieldFixture(),
      },
      providerYieldsResult: AsyncResult.fail(failure),
    });

    expect(view).toMatchObject({
      error: {
        _tag: "YieldSummaryResourceError",
        cause: failure,
        retryable: true,
      },
      providers: null,
      status: "failed",
    });
  });

  it("retains usable projections while refreshing and after refresh failure", () => {
    const selectedYield = yieldApiYieldFixture();
    const input = {
      selectedProviderYieldId: null,
      validators: new Map(),
      yield: selectedYield,
    };
    const previous = AsyncResult.success([]);

    expect(
      resolveYieldSummaryView({
        input,
        providerYieldsResult: AsyncResult.waiting(previous),
      })
    ).toMatchObject({
      error: null,
      providers: [{ name: selectedYield.metadata.name }],
      status: "refreshing",
    });

    const failure = new YieldDirectoryError({
      cause: new ApiRequestError({
        cause: new Error("refresh failed"),
        operation: "yield-directory",
      }),
    });
    expect(
      resolveYieldSummaryView({
        input,
        providerYieldsResult: AsyncResult.failure(Cause.fail(failure), {
          previousSuccess: Option.some(previous),
        }),
      })
    ).toMatchObject({
      error: { cause: failure },
      providers: [{ name: selectedYield.metadata.name }],
      status: "ready",
    });
  });

  it("resolves provider details through the canonical Yield resource graph", () => {
    const providerYield = yieldApiYieldFixture({
      id: "ethereum-provider-a",
      rewardRate: {
        components: [],
        rateType: "APY",
        total: 0.08,
      },
    });
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
                options: [providerYield.id],
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
    });
    const source = YieldResourceSource.of({
      getProvider: () => Effect.succeedSome(yieldApiProviderFixture()),
      listYields: (request: YieldDirectoryRequest) =>
        Effect.succeed({
          items: [providerYield],
          limit: request.limit,
          offset: request.offset,
          total: 1,
        }),
    } as never);
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(YieldResourceSource, source)
        ),
      ],
    });
    const summary = makeYieldSummary(
      Atom.make({
        selectedProviderYieldId: providerYield.id,
        validators: [
          decodeValidator(
            yieldApiValidatorFixture({
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
        providers: [{ rewardRate: exactDecimal("0.08") }],
        status: "ready",
      });
    } finally {
      registry.dispose();
    }
  });
});
