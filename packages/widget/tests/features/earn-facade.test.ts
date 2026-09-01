import { Effect, Layer } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import {
  type EarnTokenOption,
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  earnSelectionValidatorOptionsViewAtom,
  earnSelectionViewAtom,
  earnSelectionYieldOptionsViewAtom,
} from "../../src/features/earn/state/earn-selection";
import {
  earnTokenSelectionViewAtom,
  setEarnTokenSearchAtom,
} from "../../src/features/earn/state/token-selection";
import {
  earnValidatorModalEventAtom,
  earnValidatorSelectionViewAtom,
  selectEarnValidatorAtom,
  setEarnValidatorSearchAtom,
} from "../../src/features/earn/state/validator-selection";
import {
  earnYieldSelectionViewAtom,
  setEarnYieldSearchAtom,
} from "../../src/features/earn/state/yield-selection";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";
import { makeTestTracking } from "../utils/services/tracking-service";
import { decodeValidator } from "../utils/validators";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

const trackingLayer = (trackEvent: () => Effect.Effect<void>) =>
  Atom.initialValue(
    appRuntime.layer,
    Layer.unwrap(
      makeTestTracking({ trackEvent }).pipe(
        Effect.map((tracking) => tracking.layer)
      )
    ) as never
  );

describe("Earn facade", () => {
  it("tracks validator intent through the Earn Selection interface", async () => {
    const selectedYield = yieldApiYieldFixture();
    const validator = decodeValidator(yieldApiValidatorFixture());
    const trackEvent = vi.fn(() => Effect.void);
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        trackingLayer(trackEvent),
        Atom.initialValue(earnSelectionValidatorOptionsViewAtom, {
          canSelect: true,
          enabled: true,
          isDebouncing: false,
          items: [validator],
          page: {
            hasMore: false,
            isLoadingFirstPage: false,
            isLoadingMore: false,
          },
          search: "",
          selected: [validator],
          selectedYield,
        }),
        Atom.initialValue(earnSelectionViewAtom, {
          canSubmit: false,
          form: {
            providerYieldId: null,
            stakeAmount: "0",
            tronResource: null,
            useMaxAmount: false,
          },
          positions: new Map(),
          selection: {
            category: null,
            token: null,
            validators: [validator],
            yield: selectedYield,
          },
        }),
      ],
    });
    const unmountSelect = registry.mount(selectEarnValidatorAtom);

    try {
      registry.set(selectEarnValidatorAtom, validator.key);
      await expect
        .poll(() =>
          AsyncResult.isSuccess(registry.get(selectEarnValidatorAtom))
        )
        .toBe(true);
      expect(AsyncResult.isFailure(registry.get(selectEarnValidatorAtom))).toBe(
        false
      );
      await expect.poll(() => trackEvent.mock.calls.length).toBe(1);
      expect(trackEvent).toHaveBeenCalledWith("validatorSelected", {
        validatorAddress: validator.address,
        validatorName: validator.name,
      });

      registry.set(earnValidatorModalEventAtom, { _tag: "Opened" });
      await expect
        .poll(() => registry.get(earnValidatorModalEventAtom).waiting)
        .toBe(false);
      expect(trackEvent).toHaveBeenLastCalledWith("selectValidatorModalOpened");
    } finally {
      unmountSelect();
      registry.dispose();
    }
  });

  it("projects client-side token and yield search from semantic options", () => {
    const selectedYield = yieldApiYieldFixture();
    const tokenOption = {
      amount: "10",
      availableYields: [selectedYield.id],
      source: "balance",
      token: selectedYield.token,
    } satisfies EarnTokenOption;
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(earnSelectionStatusViewAtom, {
          blockingFailure: false,
          empty: {
            categories: false,
            tokens: false,
            yields: false,
            validators: false,
          },
          isFetching: false,
          loading: {
            wallet: false,
            categories: false,
            initialSelection: false,
            tokens: false,
            yields: false,
            positions: false,
            validators: false,
          },
        }),
        Atom.initialValue(earnSelectionTokenOptionsViewAtom, {
          canSelect: true,
          items: [tokenOption],
          selected: tokenOption,
          waiting: false,
        }),
        Atom.initialValue(earnSelectionYieldOptionsViewAtom, {
          availableCategories: [],
          canSelect: true,
          items: [selectedYield],
          selected: selectedYield,
          selectedCategory: null,
          waiting: false,
        }),
      ],
    });

    try {
      registry.set(setEarnTokenSearchAtom, selectedYield.token.symbol);
      registry.set(setEarnYieldSearchAtom, selectedYield.metadata.name);

      expect(registry.get(earnTokenSelectionViewAtom)).toMatchObject({
        filtered: [tokenOption],
      });
      expect(registry.get(earnYieldSelectionViewAtom).filtered).toEqual([
        selectedYield,
      ]);
    } finally {
      registry.dispose();
    }
  });

  it("forwards validator search into the stable selection view", () => {
    const registry = AtomRegistry.make({
      initialValues: [applicationRuntimeInitInitialValue()],
    });
    const unmount = registry.mount(earnValidatorSelectionViewAtom);

    try {
      registry.set(setEarnValidatorSearchAtom, " validator ");
      expect(registry.get(earnValidatorSelectionViewAtom)).toMatchObject({
        isDebouncing: true,
        isLoading: true,
        search: " validator ",
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
