import { Cause } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import {
  EarnCatalogError,
  type EarnEntry,
  type EarnTokenOption,
  makeDefaultEarnIntent,
} from "../../../src/features/earn/model/earn-selection/types";
import { resolveEarnView } from "../../../src/features/earn/model/earn-selection/view";
import type {
  EarnResourceResult,
  EarnViewObservations,
} from "../../../src/features/earn/model/earn-selection/view-inputs";

const entry: EarnEntry = {
  categoryGrouping: false,
  categoryOrder: [],
  walletResolution: "settled",
  walletScope: null,
};

const catalogFailure = <A>({
  waiting,
}: {
  readonly waiting: boolean;
}): EarnResourceResult<A> =>
  AsyncResult.failure(
    Cause.fail(
      new EarnCatalogError({
        cause: "offline",
        operation: "earn-token-catalog",
      })
    ),
    { waiting }
  );

const observeTokenOptions = (
  tokenOptions: EarnResourceResult<ReadonlyArray<EarnTokenOption>>
): EarnViewObservations => ({
  category: { _tag: "disabled" },
  initial: { network: null, positions: AsyncResult.success(new Map()) },
  reachableDefaultYields: null,
  tokenOptions,
  validators: { _tag: "disabled" },
  yieldCatalog: AsyncResult.initial(),
});

const resolve = (observations: EarnViewObservations) =>
  resolveEarnView({ entry, intent: makeDefaultEarnIntent(), observations });

describe("Earn view", () => {
  it("shows a failed resource that is retrying as loading, not as a blocking failure", () => {
    const view = resolve(
      observeTokenOptions(catalogFailure({ waiting: true }))
    );

    expect(view.blockingFailure).toBe(false);
    expect(view.loading.tokens).toBe(true);
    expect(view.empty.tokens).toBe(false);
  });

  it("blocks on a failed resource once it stops retrying", () => {
    const view = resolve(
      observeTokenOptions(catalogFailure({ waiting: false }))
    );

    expect(view.blockingFailure).toBe(true);
    expect(view.loading.tokens).toBe(false);
    expect(view.empty.tokens).toBe(false);
  });

  it("waits for a category catalog that is retrying before choosing a category", () => {
    const view = resolveEarnView({
      entry: { ...entry, categoryGrouping: true, categoryOrder: ["stake"] },
      intent: makeDefaultEarnIntent(),
      observations: {
        ...observeTokenOptions(AsyncResult.initial()),
        category: {
          _tag: "enabled",
          catalogs: [
            { category: "stake", result: catalogFailure({ waiting: true }) },
          ],
        },
      },
    });

    expect(view.blockingFailure).toBe(false);
    expect(view.loading.categories).toBe(true);
  });
});
