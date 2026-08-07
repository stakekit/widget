import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";
import type { PositionsData } from "../../src/domain/types/positions";
import { resolveEarnView } from "../../src/features/earn/state/earn-selection/model/view";
import type { EarnViewObservations } from "../../src/features/earn/state/earn-selection/model/view-inputs";
import {
  EarnCatalogError,
  type EarnEntry,
  makeDefaultEarnIntent,
} from "../../src/features/earn/state/earn-selection/types";

const entry: EarnEntry = {
  categoryOrder: ["stake", "defi", "rwa"],
  dashboardVariant: true,
  initParams: null,
  preferredTokenYieldsPerNetwork: null,
  tokensForEnabledYieldsOnly: false,
  walletResolution: "settled",
  walletScope: null,
};

describe("Earn view model", () => {
  it("resolves a blocking category failure from authoritative results", () => {
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "available-yield-categories",
    });
    const observations: EarnViewObservations = {
      category: {
        _tag: "enabled",
        result: AsyncResult.fail(error),
      },
      initial: {
        initYield: AsyncResult.success(null),
        initYieldId: null,
        network: null,
        positions: AsyncResult.success(new Map() as PositionsData),
        selectionSeedYieldId: null,
      },
      tokenOptions: AsyncResult.initial(),
      validators: { _tag: "disabled" },
      yieldCatalog: AsyncResult.initial(),
    };

    const view = resolveEarnView({
      entry,
      intent: makeDefaultEarnIntent(),
      observations,
    });

    expect(view).toMatchObject({
      failure: { error, stage: "categories" },
      retryTarget: null,
      status: "failed",
    });
  });

  it("retains a previous category value after a refresh failure", () => {
    const error = new EarnCatalogError({
      cause: new Error("offline"),
      operation: "available-yield-categories",
    });
    const previous = AsyncResult.success(["stake" as const]);
    const observations: EarnViewObservations = {
      category: {
        _tag: "enabled",
        result: AsyncResult.failWithPrevious(error, {
          previous: Option.some(previous),
        }),
      },
      initial: {
        initYield: AsyncResult.success(null),
        initYieldId: null,
        network: null,
        positions: AsyncResult.success(new Map() as PositionsData),
        selectionSeedYieldId: null,
      },
      tokenOptions: AsyncResult.initial(),
      validators: { _tag: "disabled" },
      yieldCatalog: AsyncResult.initial(),
    };

    const view = resolveEarnView({
      entry,
      intent: makeDefaultEarnIntent(),
      observations,
    });

    expect(view.availableCategories).toEqual(["stake"]);
    expect(view.failure).toBeNull();
  });
});
